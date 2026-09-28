import 'server-only';

import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

import { config, isProduction } from './config';
import { getStore } from './store';
import type { PublicUser, Role, SessionUser } from './types';

/**
 * Session handling: stateless, signed (HS256) JWTs in an httpOnly cookie.
 *
 * Nothing about the user's role is trusted from the client — the token is
 * verified on every request *and* re-checked against the database, so a
 * revoked or demoted account loses access immediately.
 */

const ISSUER = 'pitchaton';
const AUDIENCE = 'pitchaton-web';

let cachedSecret: Uint8Array | null = null;

/**
 * Resolution order:
 *   1. SESSION_SECRET env var (required in production)
 *   2. a private file inside .data/ so preview sessions survive restarts
 *   3. a freshly generated ephemeral secret
 */
async function getSecret(): Promise<Uint8Array> {
  if (cachedSecret) return cachedSecret;

  const fromEnv = config.session.secret;
  if (fromEnv.length >= 16) {
    cachedSecret = new TextEncoder().encode(fromEnv);
    return cachedSecret;
  }

  if (isProduction && process.env.VERCEL) {
    // Loud but non-fatal: the app still runs, sessions just don't survive a
    // redeploy. Documented in DEPLOYMENT.md.
    console.warn(
      '[pitchaton] SESSION_SECRET is not set — sessions will be invalidated on redeploy.',
    );
  }

  const dataDir = process.env.PITCHATON_DATA_DIR
    ? path.resolve(process.env.PITCHATON_DATA_DIR)
    : path.join(process.cwd(), '.data');
  const secretFile = path.join(dataDir, '.session-secret');
  try {
    const existing = (await fs.readFile(secretFile, 'utf8')).trim();
    if (existing.length >= 32) {
      cachedSecret = new TextEncoder().encode(existing);
      return cachedSecret;
    }
  } catch {
    /* first run */
  }

  const generated = crypto.randomBytes(48).toString('hex');
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(secretFile, generated, { mode: 0o600 });
  } catch {
    /* read-only filesystem: fall back to the in-memory secret below */
  }
  cachedSecret = new TextEncoder().encode(generated);
  return cachedSecret;
}

export interface SessionClaims {
  sub: string;
  email: string;
  role: Role;
  name: string;
}

export async function signSession(claims: SessionClaims): Promise<string> {
  const secret = await getSecret();
  return new SignJWT({ email: claims.email, role: claims.role, name: claims.name })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${config.session.maxAgeSeconds}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const secret = await getSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role === 'admin' ? 'admin' : 'founder',
      name: typeof payload.name === 'string' ? payload.name : '',
    };
  } catch {
    return null;
  }
}

/** Writes the session cookie. Must run inside a Route Handler or Server Action. */
export async function startSession(user: PublicUser): Promise<void> {
  const token = await signSession({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.full_name,
  });
  const jar = await cookies();
  jar.set(config.session.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: config.session.maxAgeSeconds,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.set(config.session.cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 0,
  });
}

/**
 * Current user, verified against the database. Returns null when the visitor
 * is anonymous or the token no longer matches a live account.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(config.session.cookieName)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const record = await getStore().findUserById(claims.sub);
  if (!record) return null;

  return {
    id: record.id,
    email: record.email,
    full_name: record.full_name,
    role: record.role,
    created_at: record.created_at,
  };
}

export async function getCurrentAdmin(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user?.role === 'admin' ? user : null;
}
