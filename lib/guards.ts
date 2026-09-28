import 'server-only';

import { redirect } from 'next/navigation';
import type { NextResponse } from 'next/server';

import { jsonError } from './api';
import { getCurrentUser } from './session';
import type { SessionUser } from './types';

/**
 * Server-side access guards.
 *
 * Every protected page calls one of these before it renders, and every API
 * route calls the matching API guard. UI-only hiding is never treated as
 * security: if a founder types /admin into the address bar, the server
 * redirects them before a single admin byte is produced.
 */

export async function requireUser(nextPath = '/dashboard'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=%2Fadmin');
  if (user.role !== 'admin') redirect('/dashboard?denied=admin');
  return user;
}

/* ---------------- API-flavoured guards ---------------- */

export async function apiUser(): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { response: jsonError('Sign in to continue.', 401) };
  return { user };
}

export async function apiAdmin(): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { response: jsonError('Sign in to continue.', 401) };
  if (user.role !== 'admin') return { response: jsonError('Admins only.', 403) };
  return { user };
}
