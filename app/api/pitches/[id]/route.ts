import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, publicPitch, readJson } from '@/lib/api';
import { removeUpload } from '@/lib/storage';
import { getCurrentUser } from '@/lib/session';
import { getStore } from '@/lib/store';
import { ValidationError, optionalString, parseFounders, requiredString } from '@/lib/validation';
import { isPitchEditable } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** GET /api/pitches/:id — owner or admin only. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError('Sign in to view this pitch.', 401);

  const store = getStore();
  const pitch = await store.getPitchDetail(id);
  if (!pitch) return jsonError('Pitch not found.', 404);
  if (user.role !== 'admin' && pitch.created_by !== user.id) {
    return jsonError('You do not have access to this pitch.', 403);
  }

  return jsonOk({ pitch: publicPitch(pitch) });
}

/**
 * PATCH /api/pitches/:id — edit a submission.
 * Allowed for an admin, or for the owner while edits are open (per-pitch flag
 * set by an admin, or the global edit window).
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError('Sign in to edit this pitch.', 401);

  const store = getStore();
  const pitch = await store.getPitch(id);
  if (!pitch) return jsonError('Pitch not found.', 404);

  const isOwner = pitch.created_by === user.id;
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) return jsonError('You do not have access to this pitch.', 403);

  if (!isAdmin) {
    const settings = await store.getSettings();
    const canEdit = isPitchEditable(pitch, settings);
    if (!canEdit) {
      return jsonError(
        'Editing is closed right now. Ask the Hub team to reopen your submission.',
        403,
      );
    }
  }

  const body = await readJson(request);

  try {
    const patch: { title?: string; description?: string; category?: string | null } = {};
    if (body.title !== undefined) {
      patch.title = requiredString(body.title, 'title', { min: 3, max: 160, label: 'Title' });
    }
    if (body.description !== undefined) {
      patch.description = requiredString(body.description, 'description', {
        min: 40,
        max: 6000,
        label: 'Description',
      });
    }
    if (body.category !== undefined) {
      patch.category = optionalString(body.category, 'category', { max: 80, label: 'Category' });
    }

    let founders: ReturnType<typeof parseFounders> | null = null;
    if (body.founders !== undefined) {
      founders = parseFounders(body.founders);
    }

    const updated = Object.keys(patch).length ? await store.updatePitch(id, patch) : pitch;
    if (founders) await store.replaceFounders(id, founders);

    const detail = await store.getPitchDetail(id);
    return jsonOk({ pitch: detail ? publicPitch(detail) : updated });
  } catch (error) {
    if (error instanceof ValidationError) return jsonError(error.message, 422, error.field);
    console.error('[pitchaton:patch-pitch]', error);
    return jsonError('Could not save your changes.', 500);
  }
}

/** DELETE /api/pitches/:id — admin only. Removes files from storage too. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return jsonError('Admins only.', 403);

  const store = getStore();
  const pitch = await store.getPitch(id);
  if (!pitch) return jsonError('Pitch not found.', 404);

  const files = await store.listFiles(id);
  await Promise.allSettled(files.map((file) => removeUpload(file)));
  await store.deletePitch(id);

  return jsonOk({ ok: true, deleted: pitch.code });
}
