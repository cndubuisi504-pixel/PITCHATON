import { jsonOk } from '@/lib/api';
import { getLeaderboard } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/leaderboard — public ONLY once an admin flips "publish results".
 * When unpublished this returns an empty board plus a flag, never the data.
 */
export async function GET() {
  const { settings, rows } = await getLeaderboard();
  return jsonOk({
    published: settings.results_published,
    competition_date: settings.competition_date,
    rows: settings.results_published ? rows : [],
  });
}
