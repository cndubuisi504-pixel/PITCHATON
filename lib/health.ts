import 'server-only';

import { createClient } from '@supabase/supabase-js';

/**
 * Deployment diagnostics for the Supabase driver.
 *
 * Kept out of the route handler so the probe logic can be exercised directly
 * (see `scripts/check-supabase.mjs`) against a real project or a mock.
 */

export const REQUIRED_TABLES = [
  'users',
  'pitches',
  'founders',
  'files',
  'results',
  'hub_news',
  'admin_settings',
  'email_log',
] as const;

export interface TableProbe {
  table: string;
  ok: boolean;
  detail: string;
}

export interface BucketProbe {
  name: string;
  ok: boolean;
  detail: string;
}

export interface SupabaseDiagnostics {
  ok: boolean;
  host: string;
  tables: TableProbe[];
  missing: string[];
  bucket: BucketProbe;
  verdict: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid NEXT_PUBLIC_SUPABASE_URL';
  }
}

function friendlyTableError(message: string): string {
  if (/does not exist|schema cache|relation/i.test(message)) {
    return 'missing — run supabase-schema.sql';
  }
  if (/invalid api key|jwt|unauthorized|signature/i.test(message)) {
    return 'rejected the credentials — check SUPABASE_SERVICE_ROLE_KEY';
  }
  return message;
}

export async function checkSupabase(params: {
  url: string;
  serviceRoleKey: string;
  bucket: string;
}): Promise<SupabaseDiagnostics> {
  const host = hostOf(params.url);

  if (!params.url || !params.serviceRoleKey) {
    return {
      ok: false,
      host,
      tables: [],
      missing: [...REQUIRED_TABLES],
      bucket: { name: params.bucket, ok: false, detail: 'not checked — Supabase is not configured' },
      verdict:
        'Supabase is not configured. On Netlify the local store cannot persist anything: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, then redeploy.',
    };
  }

  const client = createClient(params.url, params.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // A misconfigured host should fail fast rather than hang the health page.
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) },
  });

  const tables: TableProbe[] = await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      try {
        // NOTE: deliberately NOT `head: true` — supabase-js maps an empty 404
        // response to "204 / no rows / no error", which would report a missing
        // table as reachable. A GET surfaces the real PostgREST error.
        const { error } = await client.from(table).select('id', { count: 'exact' }).limit(1);
        if (!error) return { table, ok: true, detail: 'reachable' };
        return { table, ok: false, detail: friendlyTableError(error.message ?? 'unknown error') };
      } catch (error) {
        return {
          table,
          ok: false,
          detail: error instanceof Error ? error.message : 'connection failed',
        };
      }
    }),
  );

  const missing = tables.filter((probe) => !probe.ok).map((probe) => probe.table);

  let bucket: BucketProbe = { name: params.bucket, ok: false, detail: 'not checked' };
  try {
    const { error } = await client.storage.from(params.bucket).list('', { limit: 1 });
    bucket = error
      ? {
          name: params.bucket,
          ok: false,
          detail: /not found/i.test(error.message) ? 'bucket missing — re-run supabase-schema.sql' : error.message,
        }
      : { name: params.bucket, ok: true, detail: 'reachable' };
  } catch (error) {
    bucket = {
      name: params.bucket,
      ok: false,
      detail: error instanceof Error ? error.message : 'connection failed',
    };
  }

  const ok = !missing.length && bucket.ok;
  const credentialProblem = tables.some((probe) => /credentials/.test(probe.detail));

  const verdict = ok
    ? 'Ready. Database tables and the storage bucket are reachable.'
    : credentialProblem
      ? 'Supabase rejected the credentials. Copy the service_role / secret key from Project Settings → API keys into SUPABASE_SERVICE_ROLE_KEY and redeploy.'
      : missing.length
        ? `Missing table(s): ${missing.join(', ')}. Paste supabase-schema.sql into the Supabase SQL editor.`
        : bucket.detail;

  return { ok, host, tables, missing, bucket, verdict };
}
