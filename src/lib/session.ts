import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION_MAX_AGE = 90 * 24 * 60 * 60;

function secret(): string {
  const value = process.env.SESSION_SECRET || process.env.POOL_ACCESS_SECRET;
  if (!value) throw new Error('SESSION_SECRET or POOL_ACCESS_SECRET is required for authentication.');
  return value;
}

function signature(payload: string): string {
  return createHmac('sha256', secret()).update('sh-session:v1:' + payload).digest('base64url');
}

export function createSessionToken(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ id: userId, exp: now + SESSION_MAX_AGE * 1000 })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const expected = Buffer.from(signature(parts[0]));
    const actual = Buffer.from(parts[1]);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (typeof payload.id !== 'string' || !payload.id || !Number.isFinite(payload.exp) || payload.exp <= now) return null;
    return payload.id;
  } catch {
    return null;
  }
}

// Internal helper, deliberately not a Server Action. Only authenticated
// password/magic-link/OAuth flows may issue a session.
export async function setSessionCookie(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set('sh-session', createSessionToken(userId), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE,
  });
}
