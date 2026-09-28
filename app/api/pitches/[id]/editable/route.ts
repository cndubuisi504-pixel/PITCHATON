import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, readJson } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { getStore } from '@/lib/store';
import { booleanValue } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** POST /api/pitches/:id/editable — admin toggles edit access for one submission. */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return jsonError('Admins only.', 403);

  const body = await readJson(request);
  const editable = booleanValue(body.editable, true);

  const store = getStore();
  const pitch = await store.getPitch(id);
  if (!pitch) return jsonError('Pitch not found.', 404);

  const updated = await store.setPitchEditable(id, editable);
  return jsonOk({ pitch: updated });
}
