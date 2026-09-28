import { NextResponse, type NextRequest } from 'next/server';

import type { PitchDetail } from './types';

/**
 * Shared HTTP helpers for the API layer: one consistent JSON error shape,
 * one place to add security/cache headers.
 */

export interface ApiErrorBody {
  error: string;
  field?: string;
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...(init?.headers ?? {}),
    },
  });
}

export function jsonError(
  message: string,
  status = 400,
  field?: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message, ...(field ? { field } : {}) }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Maps thrown errors to a safe client response (never leaks stack traces). */
export function handleRouteError(error: unknown, fallback = 'Something went wrong'): NextResponse {
  const message = error instanceof Error ? error.message : fallback;
  console.error('[pitchaton:api]', error);
  return jsonError(message === fallback ? fallback : message, 500);
}

/* ------------------------------------------------------------------ *
 * Response shaping — never ship internal storage keys to the browser
 * ------------------------------------------------------------------ */

export function publicFile<T extends { storage_path?: string | null }>(file: T): Omit<T, 'storage_path'> {
  const { storage_path: _storagePath, ...rest } = file;
  return rest;
}

export function publicPitch(pitch: PitchDetail) {
  return { ...pitch, files: pitch.files.map(publicFile) };
}
