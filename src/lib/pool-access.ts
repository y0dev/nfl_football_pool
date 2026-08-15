import type { NextRequest } from 'next/server';
import { getSupabaseServiceClient } from './supabase';

// Private-pool password protection. `pools.is_private` gates *discoverability*
// (search results) and the legacy `pools.join_password` only ever gated the
// self-join flow (/api/pools/join) — neither ever stopped someone with a
// pool link from viewing picks/leaderboard/results. This module is the
// single shared gate for that: private pools require a password before any
// pool-specific data is served, verified server-side, backed by a
// pool-specific signed cookie so visitors aren't re-prompted on every page.
//
// Uses the Web Crypto API (globalThis.crypto.subtle) exclusively — available
// in both the Node.js route-handler runtime and the Edge runtime (src/proxy.ts)
// — so this module works unmodified in either.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** 30 days — long enough visitors aren't re-prompted every visit, short
 * enough access doesn't remain permanent forever. */
export const POOL_ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const MIN_POOL_PASSWORD_LENGTH = 4;

function requireSecret(): string {
  const secret = process.env.POOL_ACCESS_SECRET;
  if (!secret) throw new Error('POOL_ACCESS_SECRET is not configured.');
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256(input: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(input)));
}

// Domain-separated: one POOL_ACCESS_SECRET, two derived keys that can never
// collide with each other even if one were somehow recovered.
async function getAesKey(): Promise<CryptoKey> {
  const raw = await sha256('pool-access-enc:' + requireSecret());
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function getHmacKey(): Promise<CryptoKey> {
  const raw = await sha256('pool-access-sig:' + requireSecret());
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** Reversible (not one-way) — the commissioner must be able to recover the
 * original password for the share message, so this is AES-256-GCM
 * encryption at rest rather than a bcrypt-style hash. Never returned to
 * anyone but the pool's own commissioner (see revealPoolPassword). */
export async function encryptPoolPassword(plaintext: string): Promise<string> {
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptPoolPassword(encrypted: string): Promise<string> {
  const [ivPart, ctPart] = encrypted.split('.');
  if (!ivPart || !ctPart) throw new Error('Malformed encrypted pool password.');
  const key = await getAesKey();
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivPart) as BufferSource },
    key,
    fromBase64Url(ctPart) as BufferSource
  );
  return decoder.decode(plainBuf);
}

export interface PoolAccessTokenPayload {
  poolId: string;
  /** Snapshot of pools.private_password_version at issue time — a password
   * change bumps the DB column, which immediately invalidates every
   * previously-issued token without needing a revocation list. */
  version: number;
  /** Unix ms. */
  exp: number;
}

async function signPoolAccessToken(payload: PoolAccessTokenPayload): Promise<string> {
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await getHmacKey(), encoder.encode(payloadB64));
  return `${payloadB64}.${toBase64Url(new Uint8Array(sig))}`;
}

async function verifyPoolAccessToken(token: string): Promise<PoolAccessTokenPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getHmacKey(),
      fromBase64Url(sigB64) as BufferSource,
      encoder.encode(payloadB64)
    );
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadB64))) as PoolAccessTokenPayload;
    if (typeof payload.poolId !== 'string' || typeof payload.version !== 'number' || typeof payload.exp !== 'number') {
      return null;
    }
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Cookie is scoped to one specific pool by name, not just by payload
 * contents — Pool A's cookie and Pool B's cookie are two entirely separate
 * cookies, so there is no single global "private pools unlocked" flag that
 * could leak access across pools. */
export function poolAccessCookieName(poolId: string): string {
  return `sh_pool_${poolId}`;
}

export interface PoolAccessRow {
  id: string;
  name: string;
  is_private: boolean;
  private_password_encrypted: string | null;
  private_password_version: number;
}

export async function loadPoolAccessRow(poolId: string): Promise<PoolAccessRow | null> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from('pools')
    .select('id, name, is_private, private_password_encrypted, private_password_version')
    .eq('id', poolId)
    .maybeSingle();
  return (data as PoolAccessRow | null) ?? null;
}

export type PoolAccessResult =
  | { allowed: true; pool: PoolAccessRow }
  | { allowed: false; reason: 'not_found' }
  | { allowed: false; reason: 'no_password_configured'; pool: PoolAccessRow }
  | { allowed: false; reason: 'auth_required'; pool: PoolAccessRow };

/** The one shared access check every private-pool-data route/page uses.
 * Pure given a pool row + the raw cookie value, so callers in different
 * runtimes (Edge middleware via request.cookies, Node route handlers via
 * request.cookies, Server Components via next/headers cookies()) can each
 * supply the cookie value however that runtime reads cookies. */
export function evaluatePoolAccess(pool: PoolAccessRow | null, cookieValue: string | undefined | null): Promise<PoolAccessResult> | PoolAccessResult {
  if (!pool) return { allowed: false, reason: 'not_found' };
  if (!pool.is_private) return { allowed: true, pool };
  if (!pool.private_password_encrypted) return { allowed: false, reason: 'no_password_configured', pool };
  if (!cookieValue) return { allowed: false, reason: 'auth_required', pool };
  return verifyPoolAccessToken(cookieValue).then((payload): PoolAccessResult => {
    if (!payload || payload.poolId !== pool.id || payload.version !== pool.private_password_version) {
      return { allowed: false, reason: 'auth_required', pool };
    }
    return { allowed: true, pool };
  });
}

/** Convenience wrapper: loads the pool row and evaluates access in one call. */
export async function checkPoolAccess(poolId: string, cookieValue: string | undefined | null): Promise<PoolAccessResult> {
  const pool = await loadPoolAccessRow(poolId);
  return evaluatePoolAccess(pool, cookieValue);
}

/** Same as checkPoolAccess, reading the pool-specific cookie straight off a
 * Route Handler's NextRequest — the shared check every private-pool-data
 * API route uses as defense-in-depth behind the proxy.ts page gate (a
 * direct API call bypasses page middleware navigation but not this). */
export async function checkPoolAccessFromRequest(poolId: string, request: NextRequest): Promise<PoolAccessResult> {
  return checkPoolAccess(poolId, request.cookies.get(poolAccessCookieName(poolId))?.value);
}

export async function verifyPoolPasswordAttempt(
  poolId: string,
  password: string
): Promise<{ success: true; token: string; maxAgeSeconds: number } | { success: false; error: string }> {
  if (!password) return { success: false, error: 'Please enter the pool password.' };

  const pool = await loadPoolAccessRow(poolId);
  if (!pool) return { success: false, error: 'Pool not found.' };
  if (!pool.is_private) return { success: false, error: 'This pool does not require a password.' };
  if (!pool.private_password_encrypted) {
    return { success: false, error: 'This pool has not been configured with a password yet. Contact your commissioner.' };
  }

  let actual: string;
  try {
    actual = await decryptPoolPassword(pool.private_password_encrypted);
  } catch {
    return { success: false, error: "This pool's password could not be verified. Contact your commissioner." };
  }

  if (password !== actual) return { success: false, error: 'Incorrect password. Please try again.' };

  const token = await signPoolAccessToken({
    poolId,
    version: pool.private_password_version,
    exp: Date.now() + POOL_ACCESS_COOKIE_MAX_AGE_SECONDS * 1000,
  });
  return { success: true, token, maxAgeSeconds: POOL_ACCESS_COOKIE_MAX_AGE_SECONDS };
}

/** Commissioner-only — caller MUST independently verify the requester owns
 * this pool before calling this. Never expose the result to participants or
 * unauthenticated callers. */
export async function revealPoolPassword(poolId: string): Promise<string | null> {
  const pool = await loadPoolAccessRow(poolId);
  if (!pool?.private_password_encrypted) return null;
  try {
    return await decryptPoolPassword(pool.private_password_encrypted);
  } catch {
    return null;
  }
}

/** Minimal, family/friends-pool-appropriate rules (Step 7) — not a banking
 * app, so no complexity/character-class requirements. */
export function validatePoolPassword(password: string, confirmPassword?: string): string | null {
  if (!password || !password.trim()) return 'Please enter a password.';
  if (password.length < MIN_POOL_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_POOL_PASSWORD_LENGTH} characters.`;
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return null;
}
