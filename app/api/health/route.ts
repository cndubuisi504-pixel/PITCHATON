import { jsonOk } from '@/lib/api';
import { config, emailsConfigured, supabaseConfigured } from '@/lib/config';
import { checkSupabase } from '@/lib/health';
import { getCurrentUser } from '@/lib/session';
import { getStore, storageDriverName } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health — deployment self-check.
 *
 * After a deploy this answers the only question that matters: "is this instance
 * really talking to the database?" Anonymous visitors get a one-line status;
 * signed-in admins get the full diagnostic (what is missing and how to fix it).
 *
 * No secrets are returned — only the Supabase host, table names, and the error
 * text Supabase itself produces (which never echoes the key).
 */
export async function GET() {
  const user = await getCurrentUser();
  const driver = storageDriverName();
  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return jsonOk({
      ok: driver === 'supabase',
      driver,
      hint:
        driver === 'supabase'
          ? 'Connected to Supabase. Sign in as an admin for the full diagnostic.'
          : 'No Supabase credentials detected — running on the ephemeral local store. Sign in as an admin for details.',
    });
  }

  const diagnostics = await checkSupabase({
    url: config.supabase.url,
    serviceRoleKey: config.supabase.serviceRoleKey,
    bucket: config.supabase.bucket,
  });

  // The settings singleton is created on first read; a failure here usually
  // means the table exists but the credentials cannot write.
  let settings: { ok: boolean; detail: string } = { ok: false, detail: 'not checked' };
  if (!diagnostics.missing.includes('admin_settings')) {
    try {
      const row = await getStore().getSettings();
      settings = {
        ok: Boolean(row?.id),
        detail: `submissions ${row.submission_enabled ? 'open' : 'closed'} · results ${
          row.results_published ? 'published' : 'hidden'
        }`,
      };
    } catch (error) {
      settings = { ok: false, detail: error instanceof Error ? error.message : 'unknown error' };
    }
  }

  return jsonOk({
    ok: diagnostics.ok,
    driver,
    database: supabaseConfigured ? 'supabase' : 'local-file-store',
    storage: supabaseConfigured ? 'supabase' : 'local-disk',
    email: emailsConfigured ? 'resend' : 'log-only',
    session_secret_set: Boolean(config.session.secret),
    admin_code_set: Boolean(config.adminAccessCode),
    admin_emails: config.adminEmails,
    supabase_host: diagnostics.host,
    tables: diagnostics.tables,
    bucket: diagnostics.bucket,
    settings,
    verdict: diagnostics.verdict,
  });
}
