import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, readJson } from '@/lib/api';
import { verifyPassword } from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { startSession } from '@/lib/session';
import { getStore } from '@/lib/store';
import { emailString, requiredString } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Shared login for founders and organisers. */
export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const body = await readJson(request);

  let email: string;
  let password: string;
  try {
    email = emailString(body.email);
    password = requiredString(body.password, 'password', { max: 200, label: 'Password' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enter your email and password';
    return jsonError(message, 422);
  }

  // Two windows: per-account (stops targeted guessing) and per-IP (stops spraying).
  const byAccount = rateLimit(`login:acct:${email}`, { limit: 8, windowMs: 10 * 60 * 1000 });
  const byIp = rateLimit(`login:ip:${ip}`, { limit: 30, windowMs: 10 * 60 * 1000 });
  if (!byAccount.ok || !byIp.ok) {
    return jsonError(
      `Too many attempts. Try again in ${Math.max(byAccount.retryAfterSeconds, byIp.retryAfterSeconds)} seconds.`,
      429,
    );
  }

  const store = getStore();
  const user = await store.findUserByEmail(email);

  // Always run a hash comparison so response timing doesn't reveal existence.
  const fallbackHash = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const ok = await verifyPassword(password, user?.password_hash ?? fallbackHash);

  if (!user || !ok) {
    return jsonError('Email or password is incorrect.', 401);
  }

  const sessionUser = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    created_at: user.created_at,
  };
  await startSession(sessionUser);

  return jsonOk({ user: sessionUser, storage: store.driver });
}
