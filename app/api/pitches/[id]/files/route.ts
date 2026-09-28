import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, publicFile } from '@/lib/api';
import { config } from '@/lib/config';
import { getCurrentUser } from '@/lib/session';
import { saveUpload } from '@/lib/storage';
import { getStore } from '@/lib/store';
import { isPitchEditable } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/pitches/:id/files — attach files to an existing pitch.
 * Owners may only do this while editing is open; admins can always attach.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError('Sign in to upload files.', 401);

  const store = getStore();
  const pitch = await store.getPitch(id);
  if (!pitch) return jsonError('Pitch not found.', 404);

  const isOwner = pitch.created_by === user.id;
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) return jsonError('You do not have access to this pitch.', 403);

  if (!isAdmin) {
    const settings = await store.getSettings();
    if (!isPitchEditable(pitch, settings)) {
      return jsonError('Editing is closed right now.', 403);
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Could not read the upload.', 400);
  }

  const files = form.getAll('files').filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (!files.length) return jsonError('Choose at least one file.', 422, 'files');

  const existing = await store.listFiles(id);
  if (existing.length + files.length > config.uploads.maxFilesPerPitch) {
    return jsonError(
      `This pitch already has ${existing.length} file(s); the limit is ${config.uploads.maxFilesPerPitch}.`,
      422,
      'files',
    );
  }

  const added = [];
  for (const file of files) {
    if (file.size > config.uploads.maxFileBytes) {
      return jsonError(
        `“${file.name}” is larger than the ${Math.round(config.uploads.maxFileBytes / 1024 / 1024)}MB limit.`,
        422,
        'files',
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await saveUpload({
      pitchId: id,
      fileName: file.name,
      contentType: file.type || null,
      bytes,
    });
    const record = await store.addFile({
      pitch_id: id,
      file_name: file.name,
      file_url: stored.file_url,
      file_type: file.type || null,
      file_size: file.size,
      storage_path: stored.storage_path,
    });
    if (!stored.file_url) {
      added.push(await store.updateFile(record.id, { file_url: `/api/files/${record.id}` }));
    } else {
      added.push(record);
    }
  }

  return jsonOk({ files: added.map(publicFile) }, { status: 201 });
}
