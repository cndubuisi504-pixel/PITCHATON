import { NextResponse, type NextRequest } from 'next/server';

import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { readUpload, removeUpload } from '@/lib/storage';
import { getStore, storageDriverName } from '@/lib/store';
import { isPitchEditable } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** GET /api/files/:id — download, restricted to the pitch owner and admins. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError('Sign in to download this file.', 401);

  const store = getStore();
  const file = await store.getFile(id);
  if (!file) return jsonError('File not found.', 404);

  const pitch = await store.getPitch(file.pitch_id);
  if (!pitch) return jsonError('File not found.', 404);
  if (user.role !== 'admin' && pitch.created_by !== user.id) {
    return jsonError('You do not have access to this file.', 403);
  }

  if (storageDriverName() === 'supabase' && file.file_url) {
    return NextResponse.redirect(file.file_url, 302);
  }
  if (!file.storage_path) return jsonError('This file has no stored data.', 410);

  try {
    const bytes = await readUpload(file.storage_path);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': file.file_type || 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Content-Disposition': `attachment; filename="${file.file_name.replace(/["\r\n]/g, '')}"`,
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[pitchaton:file-read]', error);
    return jsonError('File is no longer available.', 410);
  }
}

/** DELETE /api/files/:id — owner (while editing is open) or admin. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError('Sign in first.', 401);

  const store = getStore();
  const file = await store.getFile(id);
  if (!file) return jsonError('File not found.', 404);

  const pitch = await store.getPitch(file.pitch_id);
  if (!pitch) return jsonError('File not found.', 404);

  const isAdmin = user.role === 'admin';
  if (!isAdmin && pitch.created_by !== user.id) {
    return jsonError('You do not have access to this file.', 403);
  }
  if (!isAdmin) {
    const settings = await store.getSettings();
    if (!isPitchEditable(pitch, settings)) {
      return jsonError('Editing is closed right now.', 403);
    }
  }

  await removeUpload(file);
  await store.deleteFile(id);
  return jsonOk({ ok: true });
}
