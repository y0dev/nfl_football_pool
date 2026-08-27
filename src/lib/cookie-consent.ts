// Cookie-notice state + the real cookie/local-storage inventory it describes.
// Single source of truth for both the banner/preferences UI (CookieConsentRoot)
// and this file's own comments, so the two can't drift apart.
//
// Inventory as of this writing (verified against the code that sets each one,
// not assumed):
//   - sh-session            httpOnly cookie, ~90 days   — src/actions/sessionCookie.ts
//   - nfl-pool-session      cookie, 60 seconds          — src/app/auth/callback/route.ts
//   - oauth_intent          cookie, 5 minutes           — src/app/register/page.tsx, src/app/admin/account/page.tsx
//   - oauth_plan            cookie, 5 minutes           — src/app/register/page.tsx
//   - sh_pool_<pool id>     signed cookie, ~30 days     — src/lib/pool-access.ts
//   - sh_cookie_consent     cookie, ~1 year             — this file
//   - localStorage          nfl-pool-user / nfl_pool_user_session / per-pool pick
//                           drafts — src/lib/auth.tsx, src/lib/user-session.ts,
//                           src/lib/pick-storage.ts
//
// There is currently no analytics, advertising, or tracking cookie/script
// anywhere in the app (no analytics SDK is installed, no ad pixel, no
// third-party embed). So OPTIONAL_COOKIE_CATEGORIES is empty on purpose — do
// not add a fake category here just to give the banner something to toggle.
//
// If an optional category is ever added for real (e.g. product analytics):
//   1. Add it to OPTIONAL_COOKIE_CATEGORIES below.
//   2. Bump COOKIE_CONSENT_VERSION so everyone who already dismissed the
//      banner is re-prompted under the new categories.
//   3. Default its toggle to OFF (opt-in), not on — see CookieConsentRoot.
//   4. Gate the actual script/cookie behind hasOptionalConsent('that-id').

export const COOKIE_CONSENT_COOKIE_NAME = 'sh_cookie_consent';
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export type CookieConsentChoice = 'acknowledged';

export interface StoredCookieConsent {
  version: number;
  choice: CookieConsentChoice;
  /** ISO timestamp of when the visitor dismissed the notice. */
  acknowledgedAt: string;
}

export interface CookieInventoryItem {
  name: string;
  storage: 'cookie' | 'localStorage';
  purpose: string;
  duration: string;
}

export const ESSENTIAL_COOKIE_INVENTORY: CookieInventoryItem[] = [
  { name: 'sh-session', storage: 'cookie', purpose: 'Keeps a commissioner/admin signed in.', duration: 'Up to 90 days' },
  { name: 'nfl-pool-session', storage: 'cookie', purpose: 'One-time handoff of your session right after signing in with Google. Deleted automatically the next time a page loads.', duration: '60 seconds' },
  { name: 'oauth_intent', storage: 'cookie', purpose: 'Remembers whether you were registering, signing up for a plan, or linking a Google account while you are redirected to Google and back.', duration: '5 minutes' },
  { name: 'oauth_plan', storage: 'cookie', purpose: 'Remembers which plan you selected on the Pricing page while you are redirected to Google and back.', duration: '5 minutes' },
  { name: 'sh_pool_<pool id>', storage: 'cookie', purpose: "Remembers that you've already entered a private pool's password, so you aren't asked again on every visit.", duration: 'Up to 30 days' },
  { name: COOKIE_CONSENT_COOKIE_NAME, storage: 'cookie', purpose: 'Remembers your choice on this cookie notice so it does not show again.', duration: '1 year' },
  { name: 'nfl-pool-user / nfl_pool_user_session', storage: 'localStorage', purpose: "Keeps you signed in between visits, and remembers who's picking for a participant on a shared device.", duration: 'Session-length (commissioner) / 24 hours (participant)' },
];

/** No real optional categories exist today — see the file header for why,
 * and what to do before ever populating this array. */
export const OPTIONAL_COOKIE_CATEGORIES: CookieInventoryItem[] = [];

function readRawCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Returns null if no choice has been recorded yet, or if it was recorded
 * under an older COOKIE_CONSENT_VERSION (forces a re-prompt after a real
 * change to what categories exist). */
export function getStoredCookieConsent(): StoredCookieConsent | null {
  const raw = readRawCookie(COOKIE_CONSENT_COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredCookieConsent;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCookieConsent(choice: CookieConsentChoice = 'acknowledged'): void {
  if (typeof document === 'undefined') return;
  const value: StoredCookieConsent = { version: COOKIE_CONSENT_VERSION, choice, acknowledgedAt: new Date().toISOString() };
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}; path=/; max-age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

/** Re-shows the banner on next load — used by the "Reset" control in
 * Cookie Preferences, and by tests. */
export function clearCookieConsent(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; path=/; max-age=0`;
}
