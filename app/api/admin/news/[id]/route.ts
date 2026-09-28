import type { NextRequest } from 'next/server';

import { jsonError, jsonOk } from '@/lib/api';
import { apiAdmin } from '@/lib/guards';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/admin/news/:id */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const guard = await apiAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await params;
  await getStore().deleteNews(id);
  return jsonOk({ ok: true });
}
