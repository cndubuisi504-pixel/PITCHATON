import { jsonOk } from '@/lib/api';
import { emailsConfigured, supabaseConfigured } from '@/lib/config';
import { apiAdmin } from '@/lib/guards';
import { getHubStats } from '@/lib/queries';
import { getStore, storageDriverName } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/overview — dashboard counters + platform health. */
export async function GET() {
  const guard = await apiAdmin();
  if ('response' in guard) return guard.response;

  const store = getStore();
  const [stats, settings, emails, users, results] = await Promise.all([
    getHubStats(),
    store.getSettings(),
    store.listEmails(12),
    store.countUsers(),
    store.listResults(),
  ]);

  return jsonOk({
    stats: {
      ...stats,
      users,
      resultsEntered: results.length,
    },
    settings,
    health: {
      storage: storageDriverName(),
      database: supabaseConfigured ? 'supabase' : 'local',
      email: emailsConfigured ? 'resend' : 'log-only',
    },
    recentEmails: emails,
  });
}
