import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const code = searchParams.get('code');

  // Supabase sometimes redirects OAuth codes to the Site URL (home page) when
  // the redirect URL allowlist doesn't match. Catch it here and forward to the
  // actual route handler so the code exchange still works.
  if (code && pathname !== '/auth/callback') {
    const callbackUrl = new URL('/auth/callback', request.url);
    callbackUrl.searchParams.set('code', code);
    // Preserve any other params Supabase may have appended
    searchParams.forEach((value, key) => {
      if (key !== 'code') callbackUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(callbackUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all pages except static assets, api routes, and _next internals
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
};
