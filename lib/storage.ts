import 'server-only';

import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { config, supabaseConfigured } from './config';
import { LOCAL_UPLOAD_DIR } from './store/local';
import type { PitchFile } from './types';

/**
 * File storage abstraction.
 *
 *   production → Supabase Storage bucket (public read, service-role write)
 *   local      → .data/uploads/ on disk, streamed through /api/files/[id]
 *
 * Uploads are never exposed as directory listings; reads always pass through an
 * authorisation check in the route handler.
 */

export interface StoredUpload {
  file_url: string;
  storage_path: string;
}

let bucket: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!bucket) {
    bucket = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return bucket;
}

/** Strips path traversal and unicode tricks out of an uploaded filename. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(-120);
  return cleaned || 'file';
}

export function storageKey(pitchId: string, fileName: string): string {
  const stamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${pitchId}/${stamp}-${random}-${safeFileName(fileName)}`;
}

export async function saveUpload(params: {
  pitchId: string;
  fileName: string;
  contentType: string | null;
  bytes: Buffer;
}): Promise<StoredUpload> {
  const key = storageKey(params.pitchId, params.fileName);

  if (supabaseConfigured) {
    const { error } = await supabase()
      .storage.from(config.supabase.bucket)
      .upload(key, params.bytes, {
        contentType: params.contentType ?? 'application/octet-stream',
        upsert: false,
      });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data } = supabase().storage.from(config.supabase.bucket).getPublicUrl(key);
    return { file_url: data.publicUrl, storage_path: key };
  }

  const diskPath = path.join(LOCAL_UPLOAD_DIR, ...key.split('/'));
  await fs.mkdir(path.dirname(diskPath), { recursive: true });
  await fs.writeFile(diskPath, params.bytes);
  return { file_url: '', storage_path: key };
}

export async function readUpload(storagePath: string): Promise<Buffer> {
  const diskPath = path.join(LOCAL_UPLOAD_DIR, ...storagePath.split('/'));
  const resolved = path.resolve(diskPath);
  if (!resolved.startsWith(path.resolve(LOCAL_UPLOAD_DIR))) {
    throw new Error('Invalid file path');
  }
  return fs.readFile(resolved);
}

export async function removeUpload(file: Pick<PitchFile, 'storage_path'>): Promise<void> {
  if (!file.storage_path) return;
  if (supabaseConfigured) {
    await supabase().storage.from(config.supabase.bucket).remove([file.storage_path]);
    return;
  }
  const diskPath = path.resolve(path.join(LOCAL_UPLOAD_DIR, ...file.storage_path.split('/')));
  if (!diskPath.startsWith(path.resolve(LOCAL_UPLOAD_DIR))) return;
  await fs.rm(diskPath, { force: true });
}

/**
 * Direct-to-Supabase upload ticket.
 *
 * Vercel (and most serverless hosts) cap request bodies at ~4.5MB, so a 50MB
 * deck cannot travel through a route handler in production. Instead the server
 * authorises the upload and hands the browser a one-shot signed URL; the bytes
 * go straight from the founder's device into Supabase Storage.
 */
export interface SignedUploadTicket {
  path: string;
  token: string;
  signedUrl: string;
}

export async function createSignedUpload(params: {
  pitchId: string;
  fileName: string;
}): Promise<SignedUploadTicket> {
  if (!supabaseConfigured) throw new Error('Signed uploads require Supabase Storage');
  const path = storageKey(params.pitchId, params.fileName);
  const { data, error } = await supabase()
    .storage.from(config.supabase.bucket)
    .createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Could not authorise the upload: ${error?.message ?? 'unknown error'}`);
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export function publicUrlFor(storagePath: string): string {
  if (!supabaseConfigured) return '';
  const { data } = supabase().storage.from(config.supabase.bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

export function downloadUrlFor(file: PitchFile, driver: 'local' | 'supabase'): string {
  if (driver === 'supabase') return file.file_url;
  return file.file_url || `/api/files/${file.id}`;
}
