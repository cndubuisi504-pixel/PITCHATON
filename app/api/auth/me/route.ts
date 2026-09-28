import { jsonOk } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { getStore } from '@/lib/store';
import { storageDriverName } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  return jsonOk({ user, storage: storageDriverName(), driver: getStore().driver });
}
