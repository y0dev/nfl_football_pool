import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseRouteClient } from '@/lib/supabase-ssr';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { findAccountByEmail } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  console.log('[OAuth:callback] hit — origin:', origin, '| code:', code ? code.slice(0, 12) + '…' : 'MISSING');

  if (!code) {
    console.log('[OAuth:callback] no code → redirecting to /login?error=no-code');
    return NextResponse.redirect(`${origin}/login?error=no-code`);
  }

  // Capture cookies Supabase wants to set so we can apply them to the response
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = await getSupabaseRouteClient(
    request.cookies,
    (c) => pendingCookies.push(...c)
  );

  console.log('[OAuth:callback] exchanging code for session…');
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  console.log('[OAuth:callback] exchange result — session:', !!data.session, '| error:', exchangeError?.message ?? 'none');

  if (exchangeError || !data.session) {
    debugError('exchangeCodeForSession failed:', exchangeError);
    return NextResponse.redirect(`${origin}/login?error=oauth-failed`);
  }

  const email = data.session.user.email;
  const fullName =
    data.session.user.user_metadata?.full_name ??
    data.session.user.user_metadata?.name ??
    null;

  console.log('[OAuth:callback] session user — email:', email, '| fullName:', fullName);

  if (!email) {
    return NextResponse.redirect(`${origin}/login?error=no-email`);
  }

  const serviceClient = getSupabaseServiceClient();

  // Existing account could be a super-admin or a commissioner
  const existingAccount = await findAccountByEmail(email, { activeOnly: true });

  console.log('[OAuth:callback] account lookup — found:', !!existingAccount, '| role:', existingAccount?.role ?? 'none');

  if (existingAccount) {
    const existingAdmin = existingAccount.row;
    // Reject Google sign-in only when the account has a REAL password set
    // (a non-empty hash that isn't the 'google_oauth' sentinel) — the
    // person has already proven they own this email address (Google's own
    // OAuth verified it), so telling them which method to use isn't an
    // enumeration risk the way it would be on the password-login path (see
    // loginUser.ts, which deliberately returns a generic error there). An
    // empty password_hash means no password was ever set — nothing to fall
    // back to — so treat it as unauthenticated-so-far and let Google claim
    // it, self-healing the sentinel below rather than locking the account
    // out of both methods.
    const hasRealPassword = !!existingAdmin.password_hash && existingAdmin.password_hash !== 'google_oauth';
    if (hasRealPassword) {
      console.log('[OAuth:callback] existing admin uses password auth → rejecting Google sign-in');
      // Don't leave the just-established Supabase session active for an
      // account the person hasn't actually authenticated into at the app level.
      await supabase.auth.signOut();
      const response = NextResponse.redirect(`${origin}/login?error=wrong-auth-method`);
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
      });
      return response;
    }

    if (existingAdmin.password_hash !== 'google_oauth') {
      // Empty hash — self-heal now that Google has verified this email.
      const table = existingAccount.role === 'super_admin' ? 'admins' : 'commissioners';
      void serviceClient.from(table).update({ password_hash: 'google_oauth' }).eq('id', existingAdmin.id);
    }

    console.log('[OAuth:callback] existing account → building session redirect');
    return buildSessionRedirect(origin, { ...existingAdmin, is_super_admin: existingAccount.role === 'super_admin' }, pendingCookies, request);
  }

  // New account — check intent cookie
  const intent = request.cookies.get('oauth_intent')?.value;
  console.log('[OAuth:callback] no existing admin — oauth_intent cookie:', intent ?? 'NOT SET');

  if (intent !== 'register') {
    console.log('[OAuth:callback] intent !== register → redirecting to /login?error=no-account');
    return NextResponse.redirect(
      `${origin}/login?error=no-account`
    );
  }

  // Self-registration always creates a commissioner — never a super-admin.
  const { data: newCommissioner, error: createError } = await serviceClient
    .from('commissioners')
    .insert({
      id: data.session.user.id,
      email,
      password_hash: 'google_oauth',
      full_name: fullName,
      is_active: true,
    })
    .select('id, email, full_name')
    .single();

  console.log('[OAuth:callback] commissioner insert — success:', !!newCommissioner, '| error:', createError?.message ?? 'none');

  if (createError || !newCommissioner) {
    debugError('Commissioner insert failed:', createError);
    const isDuplicate = createError?.code === '23505';
    return NextResponse.redirect(
      `${origin}/login?error=${isDuplicate ? 'duplicate-account' : 'create-failed'}`
    );
  }

  // Non-critical: set plan fields
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);
  void serviceClient.from('commissioners')
    .update({ plan: 'free', trial_ends_at: trialEndsAt.toISOString() })
    .eq('id', newCommissioner.id);

  // Non-critical: send welcome email
  fetch(`${origin}/api/admin/welcome-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: newCommissioner.email, fullName: newCommissioner.full_name ?? newCommissioner.email }),
  }).catch(() => {});

  console.log('[OAuth:callback] new commissioner created → building session redirect');
  return buildSessionRedirect(origin, { ...newCommissioner, is_super_admin: false }, pendingCookies, request, true);
}

function buildSessionRedirect(
  origin: string,
  admin: { id: string; email: string; full_name: string | null; is_super_admin: boolean },
  pendingCookies: { name: string; value: string; options: Record<string, unknown> }[],
  request: NextRequest,
  clearIntent = false
) {
  const destination = admin.is_super_admin
    ? `${origin}/admin/dashboard`
    : `${origin}/dashboard`;

  console.log('[OAuth:buildSessionRedirect] admin:', admin.email, '| is_super_admin:', admin.is_super_admin, '| destination:', destination, '| pendingCookies:', pendingCookies.length);

  const response = NextResponse.redirect(destination);

  // Hand session to the browser via a non-httpOnly cookie so AuthProvider can read it.
  // is_super_admin is intentionally omitted — authorization must always be verified
  // against the database (via verifyAdminStatus) and never trusted from client storage.
  const sessionPayload = JSON.stringify({
    id: admin.id,
    email: admin.email,
    full_name: admin.full_name,
    signedInAt: Date.now(),
  });
  console.log('[OAuth:buildSessionRedirect] session cookie payload (no is_super_admin):', { id: admin.id, email: admin.email });

  response.cookies.set('nfl-pool-session', sessionPayload, {
    path: '/',
    maxAge: 90 * 24 * 60 * 60,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false, // must be readable by JS in AuthProvider
  });

  // Persistent httpOnly session cookie for server-side route protection (middleware)
  response.cookies.set('sh-session', admin.id, {
    path: '/',
    maxAge: 90 * 24 * 60 * 60,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  });

  // Apply Supabase's own PKCE/session cookies
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });

  if (clearIntent) {
    response.cookies.delete('oauth_intent');
  }

  return response;
}
