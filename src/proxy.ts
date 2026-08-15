import { NextRequest, NextResponse } from 'next/server';
import { checkPoolAccess, poolAccessCookieName } from '@/lib/pool-access';

// /leaderboard is the commissioner multi-pool tool (pick any pool you own
// from a dropdown) — not the public per-pool view, which lives at
// /pool/[id]/leaderboard and needs no login.
const PROTECTED = ['/admin', '/dashboard', '/leaderboard', '/league'];

// Every public, no-login pool-specific page — a private pool must not
// expose any of these without a valid pool-access cookie first. Excludes
// /pool/[id]/access itself (the password-prompt page) to avoid a redirect
// loop. /playoff-picks redirects into /picks so is covered transitively,
// but is listed too since the redirect target still has to pass this gate.
const POOL_SUBROUTES = ['picks', 'leaderboard', 'history', 'playoffs', 'playoff-picks'];
const poolRoutePattern = new RegExp(`^/pool/([^/]+)/(${POOL_SUBROUTES.join('|')})(/|$)`);

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Supabase sometimes redirects OAuth codes to the Site URL instead of /auth/callback
  // when the redirect URL allowlist doesn't match. Catch it here and forward correctly.
  const code = searchParams.get('code');
  if (code && pathname !== '/auth/callback') {
    const callbackUrl = new URL('/auth/callback', request.url);
    callbackUrl.searchParams.set('code', code);
    searchParams.forEach((value, key) => {
      if (key !== 'code') callbackUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(callbackUrl);
  }

  // Protect admin and dashboard routes — require a server-side session cookie
  const needsAuth = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (needsAuth && !request.cookies.has('sh-session')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Private-pool gate — public pools pass straight through (see
  // src/lib/pool-access.ts). A commissioner viewing their own private pool
  // still needs the pool password here; being logged in as a commissioner
  // doesn't imply access to any specific pool's private content.
  const poolMatch = pathname.match(poolRoutePattern);
  if (poolMatch) {
    const poolId = poolMatch[1];
    const cookieValue = request.cookies.get(poolAccessCookieName(poolId))?.value;
    const access = await checkPoolAccess(poolId, cookieValue);
    // A pool that doesn't exist has no privacy to protect — defer to each
    // page/route's own existing "not found" handling instead of redirecting,
    // so this stays a pure additive gate (unmatched pools behave exactly as
    // they did before this feature existed).
    if (!access.allowed && access.reason !== 'not_found') {
      const accessUrl = new URL(`/pool/${poolId}/access`, request.url);
      accessUrl.searchParams.set('next', pathname + request.nextUrl.search);
      return NextResponse.redirect(accessUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on all pages except static assets, api routes, and _next internals
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
};
