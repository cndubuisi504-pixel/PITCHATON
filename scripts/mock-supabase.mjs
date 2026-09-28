#!/usr/bin/env node
/**
 * PITCHATON — mock Supabase server (PostgREST + Storage).
 *
 *   node scripts/mock-supabase.mjs            # listens on 127.0.0.1:3999
 *   MOCK_MISSING=pitches,results node scripts/mock-supabase.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * The production driver (`lib/store/supabase.ts`, `lib/storage.ts`) only runs
 * against a real Supabase project. This mock speaks just enough of the
 * PostgREST and Storage HTTP APIs — faithfully, including `Accept:
 * application/vnd.pgrst.object+json` semantics and DB defaults from
 * `supabase-schema.sql` — to exercise that code path end to end with no network
 * and no credentials:
 *
 *   node scripts/mock-supabase.mjs &
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3999 \
 *   SUPABASE_SERVICE_ROLE_KEY=mock-secret \
 *   SESSION_SECRET=dev-secret-dev-secret-dev-secret \
 *   npm run dev
 *
 * It is a development/testing tool. It is never imported by the app.
 */

import http from 'http';
import crypto from 'crypto';

const PORT = Number(process.env.MOCK_PORT || 3999);
const BUCKET = process.env.MOCK_BUCKET || 'pitch-files';
// When set, requests must present this key — lets the health-check script be
// exercised against the real "Invalid API key" failure (e.g. someone pasted the
// publishable key into SUPABASE_SERVICE_ROLE_KEY).
const SERVICE_KEY = process.env.MOCK_SERVICE_KEY || '';

const MISSING = new Set(
  (process.env.MOCK_MISSING || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ *
 * In-memory database — mirrors supabase-schema.sql
 * ------------------------------------------------------------------ */

const db = {
  users: [],
  pitches: [],
  founders: [],
  files: [],
  results: [],
  hub_news: [],
  admin_settings: [
    {
      id: 'singleton',
      submission_deadline: null,
      competition_date: null,
      submission_enabled: true,
      edit_mode_enabled: false,
      results_published: false,
      hub_name: 'ICT Hub',
      institution_name: 'ICT Hub · Enugu, Nigeria',
      updated_at: now(),
    },
  ],
  email_log: [],
};

let pitchCodeSeq = 1;

/** Column defaults + generated values, exactly as the SQL schema defines them. */
function applyDefaults(table, row) {
  const out = { ...row };
  if (table === 'admin_settings') return { id: 'singleton', ...out, updated_at: out.updated_at ?? now() };
  out.id = out.id ?? uuid();
  if (table === 'users') {
    out.role = out.role ?? 'founder';
    out.created_at = out.created_at ?? now();
  }
  if (table === 'pitches') {
    out.status = out.status ?? 'submitted';
    out.editable = out.editable ?? false;
    out.created_at = out.created_at ?? now();
    out.updated_at = out.updated_at ?? out.created_at;
    if (!out.code) out.code = `PCH-${String(pitchCodeSeq++).padStart(4, '0')}`;
  }
  if (table === 'founders') out.created_at = out.created_at ?? now();
  if (table === 'files') out.uploaded_at = out.uploaded_at ?? now();
  if (table === 'results') out.uploaded_at = out.uploaded_at ?? now();
  if (table === 'hub_news') out.published_at = out.published_at ?? now();
  if (table === 'email_log') {
    out.kind = out.kind ?? 'system';
    out.status = out.status ?? 'queued';
    out.created_at = out.created_at ?? now();
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * PostgREST query translation
 * ------------------------------------------------------------------ */

function parseParams(url) {
  const params = new URL(url, 'http://localhost').searchParams;
  const filters = [];
  let select = '*';
  let order = null;
  let limit = null;

  for (const [key, raw] of params.entries()) {
    if (key === 'select') {
      select = raw;
      continue;
    }
    if (key === 'order') {
      const [column, direction = 'asc'] = raw.split('.');
      order = { column, ascending: direction !== 'desc' };
      continue;
    }
    if (key === 'limit') {
      limit = Number(raw);
      continue;
    }
    if (key === 'on_conflict' || key === 'offset' || key === 'columns') continue;

    // PostgREST encodes a filter as `column=op.value` — the column is the key,
    // the operator and value live in the parameter *value*.
    const match = /^(eq|neq|gt|gte|lt|lte|in|is)\.(.*)$/s.exec(raw);
    if (match) filters.push({ column: key, op: match[1], value: match[2] });
  }
  return { filters, select, order, limit };
}

function matches(row, filter) {
  const value = row[filter.column];
  const { op } = filter;
  if (op === 'is') {
    if (filter.value === 'null') return value === null || value === undefined;
    return String(value) === filter.value;
  }
  if (op === 'in') {
    const list = filter.value.replace(/^\(|\)$/g, '').split(',').map((item) => item.trim());
    return list.includes(String(value));
  }
  if (op === 'eq') return String(value) === filter.value;
  if (op === 'neq') return String(value) !== filter.value;
  const numeric = Number(value);
  const target = Number(filter.value);
  if (Number.isNaN(numeric) || Number.isNaN(target)) return false;
  if (op === 'gt') return numeric > target;
  if (op === 'gte') return numeric >= target;
  if (op === 'lt') return numeric < target;
  if (op === 'lte') return numeric <= target;
  return false;
}

/* ------------------------------------------------------------------ *
 * Storage (in-memory objects)
 * ------------------------------------------------------------------ */

const objects = new Map(); // path -> { bytes, contentType }

/* ------------------------------------------------------------------ *
 * Server
 * ------------------------------------------------------------------ */

function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    ...headers,
  });
  res.end(payload);
}

function postgrestError(message, code = 'PGRST100', details = null, hint = null) {
  return { code, details, hint, message };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return { json: null, raw: Buffer.alloc(0) };
  const raw = Buffer.concat(chunks);
  try {
    return { json: JSON.parse(raw.toString('utf8')), raw };
  } catch {
    return { json: null, raw };
  }
}

/** PostgREST returns a bare object when the client asks for one. */
function wantsObject(req) {
  const accept = req.headers.accept || '';
  return accept.includes('application/vnd.pgrst.object+json');
}

function respondRows(req, res, table, rows, count) {
  const headers = {};
  if (count !== null) headers['Content-Range'] = `0-${Math.max(0, rows.length - 1)}/${count}`;

  if (req.method === 'HEAD') {
    return send(res, 200, undefined, { ...headers, 'Content-Length': '0' });
  }
  if (wantsObject(req)) {
    if (rows.length === 0) {
      return send(
        res,
        406,
        postgrestError(
          'JSON object requested, multiple (or no) rows returned',
          'PGRST116',
          'The result contains 0 rows',
        ),
      );
    }
    if (rows.length > 1) {
      return send(
        res,
        406,
        postgrestError(
          'JSON object requested, multiple (or no) rows returned',
          'PGRST116',
          `The result contains ${rows.length} rows`,
        ),
      );
    }
    return send(res, 200, rows[0], headers);
  }
  return send(res, 200, rows, headers);
}

async function handleRest(req, res, table) {
  if (MISSING.has(table)) {
    return send(
      res,
      404,
      { code: '42P01', details: null, hint: null, message: `relation "public.${table}" does not exist` },
    );
  }
  if (!Object.prototype.hasOwnProperty.call(db, table)) {
    return send(
      res,
      404,
      { code: '42P01', details: null, hint: null, message: `relation "public.${table}" does not exist` },
    );
  }

  const { filters, order, limit } = parseParams(req.url);
  const rows = db[table];

  const applyFilters = (list) =>
    list.filter((row) => filters.every((filter) => matches(row, filter)));

  const sort = (list) => {
    if (!order) return list;
    return [...list].sort((a, b) => {
      const left = a[order.column] ?? '';
      const right = b[order.column] ?? '';
      if (left === right) return 0;
      const comparison = left > right ? 1 : -1;
      return order.ascending ? comparison : -comparison;
    });
  };

  const countHeader = /count=(exact|planned|estimated)/.test(req.headers.prefer || '');

  if (req.method === 'GET' || req.method === 'HEAD') {
    const matched = applyFilters(sort(rows));
    const limited = typeof limit === 'number' ? matched.slice(0, limit) : matched;
    return respondRows(req, res, table, limited, countHeader ? matched.length : null);
  }

  if (req.method === 'POST') {
    const { json } = await readBody(req);
    const incoming = Array.isArray(json) ? json : [json];
    const isUpsert = /resolution=merge-duplicates/.test(req.headers.prefer || '');
    const conflictParam = new URL(req.url, 'http://localhost').searchParams.get('on_conflict');
    const conflictColumns = conflictParam ? conflictParam.split(',').map((c) => c.trim()) : null;

    const written = [];
    for (const item of incoming) {
      const candidate = applyDefaults(table, item ?? {});

      // Enforcement the real database would do via unique constraints.
      if (table === 'users') {
        const clash = rows.find((row) => row.email === candidate.email);
        if (clash) {
          return send(res, 409, {
            code: '23505',
            details: `Key (email)=(${candidate.email}) already exists.`,
            hint: null,
            message: 'duplicate key value violates unique constraint "users_email_key"',
          });
        }
      }
      if (table === 'results') {
        const clash = rows.find((row) => row.pitch_id === candidate.pitch_id);
        if (clash && !isUpsert) {
          return send(res, 409, {
            code: '23505',
            details: 'Key (pitch_id) already exists.',
            hint: null,
            message: 'duplicate key value violates unique constraint "results_pitch_id_key"',
          });
        }
      }

      if (isUpsert && conflictColumns) {
        const existing = rows.find((row) =>
          conflictColumns.every((column) => row[column] !== undefined && row[column] === candidate[column]),
        );
        if (existing) {
          Object.assign(existing, candidate, { id: existing.id });
          written.push(existing);
          continue;
        }
      }

      rows.push(candidate);
      written.push(candidate);
    }

    if (!/return=representation/.test(req.headers.prefer || '')) {
      return send(res, 201, undefined, { 'Content-Length': '0' });
    }
    return respondRows(req, res, table, written, null);
  }

  if (req.method === 'PATCH') {
    const { json } = await readBody(req);
    const target = applyFilters(rows);
    for (const row of target) {
      Object.assign(row, json ?? {});
      if (table === 'pitches') row.updated_at = now();
      if (table === 'admin_settings') row.updated_at = now();
    }
    if (!/return=representation/.test(req.headers.prefer || '')) return send(res, 204);
    return respondRows(req, res, table, target, null);
  }

  if (req.method === 'DELETE') {
    const target = applyFilters(rows);
    for (const row of target) {
      const index = rows.indexOf(row);
      if (index >= 0) rows.splice(index, 1);
    }
    // Emulate ON DELETE CASCADE from the schema.
    for (const row of target) {
      for (const child of ['founders', 'files', 'results']) {
        db[child] = db[child].filter((item) => item.pitch_id !== row.id);
      }
      for (const post of db.hub_news) {
        if (post.featured_pitch_id === row.id) post.featured_pitch_id = null;
      }
    }
    return send(res, 204);
  }

  return send(res, 405, postgrestError('Method not supported by the mock', 'PGRST105'));
}

async function handleStorage(req, res, pathname) {
  // POST /storage/v1/object/list/{bucket}
  const listMatch = /^\/storage\/v1\/object\/list\/([^/]+)$/.exec(pathname);
  if (listMatch && req.method === 'POST') {
    if (listMatch[1] !== BUCKET) {
      return send(res, 404, { statusCode: '404', error: 'NotFound', message: 'Bucket not found' });
    }
    return send(res, 200, []);
  }

  // POST /storage/v1/object/upload/sign/{bucket}/{path}
  const signMatch = /^\/storage\/v1\/object\/upload\/sign\/([^/]+)\/(.+)$/.exec(pathname);
  if (signMatch && req.method === 'POST') {
    const [, bucket, objectPath] = signMatch;
    if (bucket !== BUCKET) {
      return send(res, 404, { statusCode: '404', error: 'NotFound', message: 'Bucket not found' });
    }
    return send(res, 200, {
      url: `/object/upload/sign/${bucket}/${objectPath}?token=mock-${crypto.randomBytes(8).toString('hex')}`,
    });
  }

  // PUT /storage/v1/object/upload/sign/{bucket}/{path}?token=… (browser upload)
  if (signMatch && req.method === 'PUT') {
    const [, bucket, objectPath] = signMatch;
    const { raw } = await readBody(req);
    objects.set(`${bucket}/${objectPath}`, {
      bytes: raw,
      contentType: req.headers['content-type'] || 'application/octet-stream',
    });
    return send(res, 200, { Key: `${bucket}/${objectPath}` });
  }

  // POST /storage/v1/object/sign/{bucket}/{path} → short-lived download token
  const signDownload = /^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/.exec(pathname);
  if (signDownload && req.method === 'POST') {
    const [, bucket, objectPath] = signDownload;
    const { json } = await readBody(req);
    if (bucket !== BUCKET) {
      return send(res, 404, { statusCode: '404', error: 'NotFound', message: 'Bucket not found' });
    }
    if (!objects.has(`${bucket}/${objectPath}`)) {
      return send(res, 404, { statusCode: '404', error: 'NotFound', message: 'Object not found' });
    }
    const expiresIn = Number(json?.expiresIn ?? 60);
    return send(res, 200, {
      signedURL: `/object/sign/${bucket}/${objectPath}?token=mock-${crypto.randomBytes(8).toString('hex')}`,
      expiresIn,
    });
  }

  // GET /storage/v1/object/sign/{bucket}/{path}?token=… (signed download)
  if (signDownload && req.method === 'GET') {
    const [, bucket, objectPath] = signDownload;
    const stored = objects.get(`${bucket}/${objectPath}`);
    if (!stored) return send(res, 400, { statusCode: '400', error: 'InvalidRequest', message: 'Invalid token' });
    res.writeHead(200, { 'Content-Type': stored.contentType, 'Content-Length': stored.bytes.length });
    return res.end(stored.bytes);
  }

  // DELETE /storage/v1/object/{bucket} with { prefixes: [...] }
  const bulkDelete = /^\/storage\/v1\/object\/([^/]+)$/.exec(pathname);
  if (bulkDelete && req.method === 'DELETE') {
    const { json } = await readBody(req);
    const prefixes = json?.prefixes ?? [];
    for (const prefix of prefixes) objects.delete(`${bulkDelete[1]}/${prefix}`);
    return send(res, 200, []);
  }

  // GET /storage/v1/object/public/{bucket}/{path}
  // The bucket is private, so this endpoint refuses — exactly like Supabase.
  const publicMatch = /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(pathname);
  if (publicMatch && req.method === 'GET') {
    return send(res, 400, {
      statusCode: '400',
      error: 'InvalidRequest',
      message: 'Object not found or bucket is private',
    });
  }

  // DELETE /storage/v1/object/{bucket}/{path}
  const objectMatch = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(pathname);
  if (objectMatch && req.method === 'DELETE') {
    objects.delete(`${objectMatch[1]}/${objectMatch[2]}`);
    return send(res, 200, { message: 'Successfully deleted' });
  }

  // HEAD /storage/v1/object/{bucket}/{path} — existence probe
  if (objectMatch && req.method === 'HEAD') {
    return send(res, objects.has(`${objectMatch[1]}/${objectMatch[2]}`) ? 200 : 404);
  }

  return send(res, 404, { message: `Mock storage has no route for ${req.method} ${pathname}` });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') return send(res, 204);

  if (pathname === '/rest/v1/' || pathname === '/rest/v1') {
    return send(res, 200, { message: 'PITCHATON mock PostgREST is running', tables: Object.keys(db) });
  }

  if (SERVICE_KEY) {
    const presented =
      req.headers.apikey ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (presented !== SERVICE_KEY) {
      return send(res, 401, {
        message: 'Invalid API key',
        hint: 'Double check your Supabase `anon` or `service_role` API key.',
        code: '401',
      });
    }
  }

  if (pathname.startsWith('/rest/v1/')) {
    const table = pathname.slice('/rest/v1/'.length).split('/')[0];
    try {
      return await handleRest(req, res, table);
    } catch (error) {
      console.error('[mock] rest error', error);
      return send(res, 500, { message: error instanceof Error ? error.message : 'mock failure' });
    }
  }

  if (pathname.startsWith('/storage/v1/')) {
    try {
      return await handleStorage(req, res, pathname);
    } catch (error) {
      console.error('[mock] storage error', error);
      return send(res, 500, { message: error instanceof Error ? error.message : 'mock failure' });
    }
  }

  return send(res, 404, { message: `Mock has no route for ${req.method} ${pathname}` });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`
  PITCHATON mock Supabase listening on http://127.0.0.1:${PORT}
  bucket: ${BUCKET}${MISSING.size ? ` · simulating missing tables: ${[...MISSING].join(', ')}` : ''}

  Point the app at it:
    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${PORT} \\
    SUPABASE_SERVICE_ROLE_KEY=mock-secret \\
    npm run dev
`);
});

export { db, objects };
