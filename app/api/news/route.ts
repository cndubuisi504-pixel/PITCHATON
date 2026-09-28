import { jsonOk } from '@/lib/api';
import { getNewsFeed } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/news — public hub news feed (newest first). */
export async function GET() {
  const posts = await getNewsFeed();
  return jsonOk({ posts });
}
