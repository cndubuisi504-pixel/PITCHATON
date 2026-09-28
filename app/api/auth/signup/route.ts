import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, readJson } from '@/lib/api';
import { AdminClaimError, hashPassword, resolveSignupRole } from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { startSession } from '@/lib/session';
import { getStore } from '@/lib/store';
import { ValidationError, booleanValue, emailString, optionalString, passwordString, requiredString } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Single signup endpoint for everyone.
 *
 * Founders and organisers use the exact same form. The only difference is the
 * optional "administrator" claim, which the server validates against
 * ADMIN_ACCESS_CODE (or the Hub's own allow-listed address). The browser never
 * decides anybody's role.
 */
export async function POST(request: NextRequest) {
  const limit = rateLimit(`signup:${clientIp(request.headers)}`, {
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) {
    return jsonError('Too many signup attempts. Try again in a few minutes.', 429);
  }

  const body = await readJson(request);

  try {
    const fullName = requiredString(body.full_name ?? body.name, 'full_name', {
      min: 2,
      max: 120,
      label: 'Full name',
    });
    const email = emailString(body.email);
    const password = passwordString(body.password);

    if (password.toLowerCase() === email.toLowerCase()) {
      throw new ValidationError('password', 'Choose a password that is not your email address');
    }

    const wantsAdmin = booleanValue(body.is_admin, false);
    const adminCode = optionalString(body.admin_code, 'admin_code', { max: 200, label: 'Admin code' });

    const store = getStore();
    const existing = await store.findUserByEmail(email);
    if (existing) {
      return jsonError('An account with this email already exists. Try logging in.', 409, 'email');
    }

    const decision = await resolveSignupRole({ email, wantsAdmin, adminCode });
    const passwordHash = await hashPassword(password);

    const user = await store.createUser({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      role: decision.role,
    });

    const sessionUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      created_at: user.created_at,
    };
    await startSession(sessionUser);

    const driver = store.driver;
    return jsonOk(
      {
        user: sessionUser,
        role_reason: decision.reason,
        storage: driver,
        notice:
          decision.reason === 'admin-bootstrap'
            ? 'First admin created. Set ADMIN_ACCESS_CODE in your environment so future organisers must enter it.'
            : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonError(error.message, 422, error.field);
    }
    if (error instanceof AdminClaimError) {
      return jsonError(error.message, 403, 'admin_code');
    }
    const message = error instanceof Error ? error.message : 'Could not create your account';
    console.error('[pitchaton:signup]', error);
    return jsonError(message, 500);
  }
}
