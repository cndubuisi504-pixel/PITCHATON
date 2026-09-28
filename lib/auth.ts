import 'server-only';

import bcrypt from 'bcryptjs';

import { config } from './config';
import { getStore } from './store';
import type { Role } from './types';

/**
 * Role resolution — the single place that decides "founder" vs "admin".
 *
 * Rules (evaluated server-side only, never in the browser):
 *
 *   1. An email listed in ADMIN_EMAILS (default: contacteihpitchaton@gmail.com)
 *      is always an admin, no code needed. That is the Hub's own account.
 *   2. Anyone else becomes an admin only by supplying the admin access code
 *      (ADMIN_ACCESS_CODE) on the shared signup form — this is how a second
 *      organiser or a `name+admin@…` test account is created.
 *   3. The very first admin claim on an empty database is allowed without the
 *      code *only* for a listed ADMIN_EMAILS address (bootstrap), so the Hub
 *      can get in on day one without touching environment variables.
 *
 * Deliberately NOT implemented: the "any email containing +admin is an admin"
 * shortcut from the original draft — it would hand full admin rights to anyone
 * who typed `x+admin@gmail.com` into a public signup form.
 */

const BCRYPT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function isAdminEmail(email: string): boolean {
  return config.adminEmails.includes(email.trim().toLowerCase());
}

export interface ClaimInput {
  email: string;
  wantsAdmin: boolean;
  adminCode?: string | null;
}

export interface ClaimDecision {
  role: Role;
  /** Explains *why* the role was granted — surfaced in logs and API responses. */
  reason: 'member' | 'admin-email' | 'admin-code' | 'admin-bootstrap';
}

export async function resolveSignupRole(input: ClaimInput): Promise<ClaimDecision> {
  const email = input.email.trim().toLowerCase();
  const onAllowList = isAdminEmail(email);

  // Rule 1 — the Hub's own account is always an admin.
  if (onAllowList) {
    return { role: 'admin', reason: 'admin-email' };
  }

  if (!input.wantsAdmin) {
    return { role: 'founder', reason: 'member' };
  }

  // Rule 2 — access code.
  const store = getStore();
  const provided = (input.adminCode ?? '').trim();

  if (provided && provided === config.adminAccessCode) {
    return { role: 'admin', reason: 'admin-code' };
  }

  // Rule 3 — bootstrap: with no admin account in existence yet, an allow-listed
  // Hub address may claim admin even before ADMIN_ACCESS_CODE is configured.
  const admins = await getStore().countAdmins();
  if (admins === 0 && onAllowList) {
    return { role: 'admin', reason: 'admin-bootstrap' };
  }

  if (provided === '' && admins === 0) {
    console.warn(
      '[pitchaton] rejected an admin claim without a code — the bootstrap account must use a configured ADMIN_EMAILS address.',
    );
  }

  throw new AdminClaimError(
    provided
      ? 'That admin access code is not valid.'
      : 'An admin access code is required to create an administrator account.',
  );
}

export class AdminClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminClaimError';
  }
}
