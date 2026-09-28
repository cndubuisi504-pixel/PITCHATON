#!/usr/bin/env node
/**
 * PITCHATON — Supabase connection check (no app server needed).
 *
 *   npm run check:supabase
 *
 * Reads the same variables the app uses and reports, table by table, whether
 * the database, the storage bucket and the credentials are working. Run it
 * after pasting supabase-schema.sql, or whenever the deployed site misbehaves —
 * it tells you exactly which piece is wrong.
 *
 * Reads .env.local automatically (and .env, if present).
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, '').trim();
  }
}

loadEnvFile(path.join(process.cwd(), '.env'));
loadEnvFile(path.join(process.cwd(), '.env.local'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'pitch-files';

const REQUIRED_TABLES = [
  'users',
  'pitches',
  'founders',
  'files',
  'results',
  'hub_news',
  'admin_settings',
  'email_log',
];

if (!url || !serviceRoleKey) {
  console.error(`
✗ Supabase is not configured.

  Missing: ${!url ? 'NEXT_PUBLIC_SUPABASE_URL ' : ''}${!serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : ''}

  Add them to .env.local (local) or Netlify → Site configuration → Environment
  variables (production), then run this again.
`);
  process.exit(1);
}

const { createClient } = await import('@supabase/supabase-js');
const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
});

const host = (() => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
})();

console.log(`\nPITCHATON → Supabase check\n  host   ${host}\n  bucket ${bucket}\n`);

let failures = 0;
for (const table of REQUIRED_TABLES) {
  try {
    // A GET (not HEAD) so a missing table surfaces its PostgREST error.
    const { error } = await client.from(table).select('id', { count: 'exact' }).limit(1);
    if (error) {
      failures += 1;
      const hint = /does not exist|schema cache|relation/i.test(error.message)
        ? 'run supabase-schema.sql in the SQL editor'
        : error.message;
      console.log(`  ✗ ${table.padEnd(16)} ${hint}`);
    } else {
      console.log(`  ✓ ${table.padEnd(16)} reachable`);
    }
  } catch (error) {
    failures += 1;
    console.log(`  ✗ ${table.padEnd(16)} ${error instanceof Error ? error.message : 'connection failed'}`);
  }
}

try {
  const { error } = await client.storage.from(bucket).list('', { limit: 1 });
  if (error) {
    failures += 1;
    console.log(`  ✗ ${'storage bucket'.padEnd(16)} ${error.message}`);
  } else {
    console.log(`  ✓ ${'storage bucket'.padEnd(16)} reachable`);
  }
} catch (error) {
  failures += 1;
  console.log(`  ✗ ${'storage bucket'.padEnd(16)} ${error instanceof Error ? error.message : 'connection failed'}`);
}

if (failures) {
  console.log(`
✗ ${failures} problem(s) found.

  • Missing tables / bucket → paste supabase-schema.sql into the Supabase SQL
    editor (Dashboard → SQL Editor → New query → Run).
  • "Invalid API key" → copy the secret key from Project Settings → API keys
    into SUPABASE_SERVICE_ROLE_KEY. The publishable key will NOT work here.
`);
  process.exit(1);
}

console.log('\n✓ Everything reachable. Supabase is ready for PITCHATON.\n');
