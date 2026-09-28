import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, publicFile, readJson } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { getStore } from '@/lib/store';
import { publicUrlFor, safeFileName } from '@/lib/storage';
import { authoriseUpload } from '@/lib/uploads';
import { asObject } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/pitches/:id/files/register
 *
 * Records attachments whose bytes were uploaded straight to Supabase Storage.
 * The storage path is validated to belong to this pitch, so a founder cannot
 * claim someone else's object.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError('Sign in to attach files.', 401);

  const body = await readJson(request);
  const rawFiles = Array.isArray(body.files) ? body.files : [];

  const incoming = rawFiles.map((entry) => {
    const file = asObject(entry);
    return {
      storage_path: typeof file.storage_path === 'string' ? file.storage_path : '',
      file_name: typeof file.file_name === 'string' ? safeFileName(file.file_name) : 'file',
      file_type: typeof file.file_type === 'string' ? file.file_type : null,
      file_size: Number(file.file_size) || 0,
    };
  });

  const valid = incoming.filter((file) => file.storage_path.startsWith(`${id}/`));
  if (!valid.length) return jsonError('No uploaded files were provided.', 422, 'files');

  const permission = await authoriseUpload({
    pitchId: id,
    userId: user.id,
    role: user.role,
    incomingBytes: valid.reduce((total, file) => total + file.file_size, 0),
    incomingCount: valid.length,
  });
  if (!permission.ok) return jsonError(permission.message, permission.status);

  const store = getStore();
  const created = [];
  for (const file of valid) {
    const record = await store.addFile({
      pitch_id: id,
      file_name: file.file_name,
      file_url: publicUrlFor(file.storage_path) || `/api/files/pending`,
      file_type: file.file_type,
      file_size: file.file_size,
      storage_path: file.storage_path,
    });
    created.push(record);
  }

  return jsonOk({ files: created.map(publicFile) }, { status: 201 });
}
