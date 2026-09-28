import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, readJson } from '@/lib/api';
import { config } from '@/lib/config';
import { getCurrentUser } from '@/lib/session';
import { createSignedUpload, safeFileName } from '@/lib/storage';
import { authoriseUpload } from '@/lib/uploads';
import { asObject } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/pitches/:id/files/sign
 *
 * Production path for big attachments. The server checks ownership + editing
 * window, then returns one-shot Supabase Storage upload URLs so the browser can
 * send the bytes directly (bypassing the serverless request-body limit).
 *
 * When Supabase is not configured this answers `mode: "proxy"` and the client
 * falls back to the multipart endpoint.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return jsonError('Sign in to upload files.', 401);

  const body = await readJson(request);
  const rawFiles = Array.isArray(body.files) ? body.files : [];

  const incoming = rawFiles.map((entry) => {
    const file = asObject(entry);
    return {
      file_name: typeof file.file_name === 'string' ? safeFileName(file.file_name) : 'file',
      file_type: typeof file.file_type === 'string' ? file.file_type : null,
      file_size: Number(file.file_size) || 0,
    };
  });

  if (!incoming.length) return jsonError('No files were provided.', 422, 'files');
  if (incoming.length > config.uploads.maxFilesPerPitch) {
    return jsonError('Too many files in one request.', 422, 'files');
  }
  const oversize = incoming.find((file) => file.file_size > config.uploads.maxFileBytes);
  if (oversize) {
    return jsonError(
      `“${oversize.file_name}” is larger than the ${Math.round(
        config.uploads.maxFileBytes / 1024 / 1024,
      )}MB limit.`,
      422,
      'files',
    );
  }

  const permission = await authoriseUpload({
    pitchId: id,
    userId: user.id,
    role: user.role,
    incomingBytes: incoming.reduce((total, file) => total + file.file_size, 0),
    incomingCount: incoming.length,
  });
  if (!permission.ok) return jsonError(permission.message, permission.status);

  if (permission.mode === 'proxy') {
    return jsonOk({ mode: 'proxy' });
  }

  try {
    const tickets = [];
    for (const file of incoming) {
      const ticket = await createSignedUpload({ pitchId: id, fileName: file.file_name });
      tickets.push({ ...file, ...ticket });
    }
    return jsonOk({ mode: 'direct', tickets });
  } catch (error) {
    console.error('[pitchaton:sign-upload]', error);
    // Never leave the founder stuck: fall back to the proxied upload.
    return jsonOk({ mode: 'proxy', reason: 'signed-upload-unavailable' });
  }
}
