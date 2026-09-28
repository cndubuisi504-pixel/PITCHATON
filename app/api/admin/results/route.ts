import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, readJson } from '@/lib/api';
import { apiAdmin } from '@/lib/guards';
import { sendStatusChangeEmail } from '@/lib/email';
import { getStore } from '@/lib/store';
import type { PitchStatus } from '@/lib/types';
import { ValidationError, numberValue, optionalString } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/results — every result row, ranked. */
export async function GET() {
  const guard = await apiAdmin();
  if ('response' in guard) return guard.response;

  const store = getStore();
  const [results, pitches] = await Promise.all([
    store.listResults(),
    store.listPitchDetails({}),
  ]);

  const byId = new Map(pitches.map((pitch) => [pitch.id, pitch]));
  return jsonOk({
    results: results.map((result) => ({
      ...result,
      pitch: byId.get(result.pitch_id)
        ? {
            id: result.pitch_id,
            code: byId.get(result.pitch_id)!.code,
            title: byId.get(result.pitch_id)!.title,
            category: byId.get(result.pitch_id)!.category,
            status: byId.get(result.pitch_id)!.status,
          }
        : null,
    })),
    candidates: pitches.map((pitch) => ({
      id: pitch.id,
      code: pitch.code,
      title: pitch.title,
      category: pitch.category,
      status: pitch.status,
      result: pitch.result,
    })),
  });
}

/**
 * POST /api/admin/results — manual entry / upsert.
 * Payload: { pitch_id | pitch_code, rank, score?, notes?, mark_winner? }
 */
export async function POST(request: NextRequest) {
  const guard = await apiAdmin();
  if ('response' in guard) return guard.response;

  const body = await readJson(request);
  const store = getStore();

  try {
    const rank = numberValue(body.rank, 'rank', { min: 1, max: 999, label: 'Rank', required: true })!;
    const score = numberValue(body.score, 'score', { min: 0, max: 1000, label: 'Score' });
    const notes = optionalString(body.notes, 'notes', { max: 600, label: 'Notes' });
    const markWinner = body.mark_winner === true;

    let pitchId = typeof body.pitch_id === 'string' ? body.pitch_id.trim() : '';
    const code = typeof body.pitch_code === 'string' ? body.pitch_code.trim().toUpperCase() : '';

    if (!pitchId && code) {
      const all = await store.listPitchDetails({});
      const match = all.find(
        (pitch) => pitch.code.toUpperCase() === code || pitch.id === code || pitch.title.toLowerCase() === code.toLowerCase(),
      );
      if (!match) return jsonError(`No pitch matches “${code}”.`, 404, 'pitch_code');
      pitchId = match.id;
    }
    if (!pitchId) return jsonError('Choose a pitch for this result.', 422, 'pitch_id');

    const pitch = await store.getPitch(pitchId);
    if (!pitch) return jsonError('Pitch not found.', 404, 'pitch_id');

    const previous = await store.getResultForPitch(pitchId);
    const result = await store.upsertResult({ pitch_id: pitchId, rank, score, notes });

    // Rank 1 optionally promotes the pitch to "winner" and notifies the team.
    if (markWinner && pitch.status !== 'winner') {
      await store.setPitchStatus(pitchId, 'winner' as PitchStatus);
      const detail = await store.getPitchDetail(pitchId);
      const recipients = new Map<string, string>();
      if (detail?.owner) recipients.set(detail.owner.email, detail.owner.full_name);
      for (const founder of detail?.founders ?? []) {
        if (!recipients.has(founder.email)) recipients.set(founder.email, founder.name);
      }
      await Promise.allSettled(
        Array.from(recipients.entries()).map(([email, name]) =>
          sendStatusChangeEmail({
            to: email,
            founderName: name,
            pitch: { ...pitch, status: 'winner' as PitchStatus },
            status: 'winner' as PitchStatus,
          }),
        ),
      );
    }

    return jsonOk({ result, updated: Boolean(previous) }, { status: previous ? 200 : 201 });
  } catch (error) {
    if (error instanceof ValidationError) return jsonError(error.message, 422, error.field);
    console.error('[pitchaton:results]', error);
    return jsonError('Could not save that result.', 500);
  }
}

/** DELETE /api/admin/results?pitch_id=… */
export async function DELETE(request: NextRequest) {
  const guard = await apiAdmin();
  if ('response' in guard) return guard.response;

  const pitchId = new URL(request.url).searchParams.get('pitch_id');
  if (!pitchId) return jsonError('pitch_id is required.', 422);

  await getStore().deleteResult(pitchId);
  return jsonOk({ ok: true });
}
