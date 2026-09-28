import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, readJson } from '@/lib/api';
import { sendStatusChangeEmail } from '@/lib/email';
import { getCurrentUser } from '@/lib/session';
import { getStore } from '@/lib/store';
import { PITCH_STATUSES, type PitchStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** POST /api/pitches/:id/status — admin-only status transition + founder email. */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return jsonError('Admins only.', 403);

  const body = await readJson(request);
  const status = String(body.status ?? '') as PitchStatus;
  if (!PITCH_STATUSES.includes(status)) {
    return jsonError(`Status must be one of: ${PITCH_STATUSES.join(', ')}`, 422, 'status');
  }

  const store = getStore();
  const existing = await store.getPitch(id);
  if (!existing) return jsonError('Pitch not found.', 404);

  if (existing.status === status) {
    return jsonOk({ pitch: existing, unchanged: true });
  }

  const pitch = await store.setPitchStatus(id, status);
  const detail = await store.getPitchDetail(id);

  // Notify the team: the submitting account plus every listed founder with a
  // distinct address.
  const recipients = new Map<string, string>();
  if (detail?.owner?.email) recipients.set(detail.owner.email.toLowerCase(), detail.owner.full_name);
  for (const founder of detail?.founders ?? []) {
    const email = founder.email.toLowerCase();
    if (!recipients.has(email)) recipients.set(email, founder.name);
  }

  const results = await Promise.allSettled(
    Array.from(recipients.entries()).map(([email, name]) =>
      sendStatusChangeEmail({ to: email, founderName: name, pitch, status }),
    ),
  );

  const emailed = results.filter(
    (result) => result.status === 'fulfilled' && result.value.delivered,
  ).length;

  return jsonOk({
    pitch,
    notified: recipients.size,
    delivered: emailed,
  });
}
