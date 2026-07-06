import { NextRequest, NextResponse } from 'next/server';

// /leaderboard is the commissioner multi-pool tool (pick any pool you own
// from a dropdown) — not the public per-pool view, which lives at
// /pool/[id]/leaderboard and needs no login.
const PROTECTED = ['/admin', '/dashboard', '/leaderboard'];

export function proxy(request: NextRequest) {
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

  return NextResponse.next();
}

export const config = {
  // Run on all pages except static assets, api routes, and _next internals
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
};
