import 'server-only';

import { config, supabaseConfigured } from './config';
import { getStore } from './store';
import { isPitchEditable } from './utils';

/**
 * Shared authorisation for anything an upload needs to check:
 * "may this session attach files to this pitch, and how many bytes are left?"
 */

export interface UploadPermission {
  ok: true;
  mode: 'direct' | 'proxy';
}

export interface UploadDenied {
  ok: false;
  status: number;
  message: string;
}

export async function authoriseUpload(params: {
  pitchId: string;
  userId: string;
  role: 'founder' | 'admin';
  incomingBytes: number;
  incomingCount: number;
}): Promise<UploadPermission | UploadDenied> {
  const store = getStore();
  const pitch = await store.getPitch(params.pitchId);
  if (!pitch) return { ok: false, status: 404, message: 'Pitch not found.' };

  const isAdmin = params.role === 'admin';
  if (!isAdmin && pitch.created_by !== params.userId) {
    return { ok: false, status: 403, message: 'You do not have access to this pitch.' };
  }

  if (!isAdmin) {
    const settings = await store.getSettings();
    if (!isPitchEditable(pitch, settings)) {
      return { ok: false, status: 403, message: 'Editing is closed right now.' };
    }
  }

  const existing = await store.listFiles(params.pitchId);
  if (existing.length + params.incomingCount > config.uploads.maxFilesPerPitch) {
    return {
      ok: false,
      status: 422,
      message: `This pitch already has ${existing.length} file(s); the limit is ${config.uploads.maxFilesPerPitch}.`,
    };
  }

  const storedBytes = existing.reduce((total, file) => total + (file.file_size ?? 0), 0);
  if (storedBytes + params.incomingBytes > config.uploads.maxTotalBytesPerPitch) {
    return {
      ok: false,
      status: 422,
      message: `Attachments for this pitch would exceed ${Math.round(
        config.uploads.maxTotalBytesPerPitch / 1024 / 1024,
      )}MB in total.`,
    };
  }

  return { ok: true, mode: supabaseConfigured ? 'direct' : 'proxy' };
}

export function uploadLimits() {
  return {
    maxFileBytes: config.uploads.maxFileBytes,
    maxFilesPerPitch: config.uploads.maxFilesPerPitch,
    maxTotalBytesPerPitch: config.uploads.maxTotalBytesPerPitch,
  };
}
