import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseRouteClient } from '@/lib/supabase-ssr';

import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { findAccountByEmail, findAccountById } from '@/lib/accounts';
import { debugError } from '@/lib/utils';
import { trialEndDate } from '@/lib/plan';
import { emailService } from '@/lib/email';
import { TRIAL_DAYS, isTrialEnabled } from '@/lib/pricing';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const providerError = searchParams.get('error');

  console.log('[OAuth:callback] hit — origin:', origin, '| code:', code ? code.slice(0, 12) + '…' : 'MISSING', '| error:', providerError ?? 'none');

  if (!code) {
    // 'access_denied' is what Google/Supabase send back when the user backs
    // out of the account chooser or declines consent — that's not a
    // failure, so it shouldn't produce an error banner (see Step 4/5 of the
    // Google auth audit: cancelling must never surface a false auth error).
    // Any other missing-code case (misconfigured provider, expired PKCE
    // verifier, etc.) is a real failure and should say so rather than fail
    // silently — the previous behavior mapped every missing-code case to an
    // unhandled 'no-code' param that the login page never displayed.
    const wasCancelled = providerError === 'access_denied';
    const destination = request.cookies.get('oauth_intent')?.value === 'link' ? '/admin/account' : '/login';
    const errorParam = wasCancelled ? '' : '?error=oauth-failed';
    console.log(`[OAuth:callback] no code (${wasCancelled ? 'user cancelled' : 'real failure'}) → redirecting to ${destination}${errorParam}`);
    const response = NextResponse.redirect(`${origin}${destination}${errorParam}`);
    response.cookies.delete('oauth_intent');
    return response;
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

  // "Connect Google" from Account Settings — set alongside oauth_intent=link
  // by the settings page before the redirect (src/app/admin/account/page.tsx).
  // A completely separate path from normal sign-in/register below: it never
  // touches the app-level session (the user is already logged in as
  // whoever's sh-session cookie is present), it just verifies the Google
  // account's email matches that existing session and flips google_linked.
  if (request.cookies.get('oauth_intent')?.value === 'link') {
    return handleLinkIntent(email, origin, request, supabase, pendingCookies);
  }

  // Existing account could be a super-admin or a commissioner
  const existingAccount = await findAccountByEmail(email, { activeOnly: true });

  console.log('[OAuth:callback] account lookup — found:', !!existingAccount, '| role:', existingAccount?.role ?? 'none');

  if (existingAccount) {
    const existingAdmin = existingAccount.row;
    // google_linked is the source of truth (set at signup, or via the
    // Connect Google flow above) — decoupled from password_hash so an
    // account can have both a real password AND Google linked at once.
    // password_hash's 'google_oauth' sentinel is kept only as a fallback
    // for rows that predate the google_linked column (self-healed below).
    const rawGoogleLinked = existingAdmin.google_linked === true;
    const sentinelMatch = existingAdmin.password_hash === 'google_oauth';
    const isGoogleLinked = rawGoogleLinked || sentinelMatch;
    const hasRealPassword = !!existingAdmin.password_hash && existingAdmin.password_hash !== 'google_oauth';

    // Reject only when Google was never linked AND a real password exists —
    // telling them which method to use isn't an enumeration risk here the
    // way it would be on the password-login path (see loginUser.ts, which
    // deliberately returns a generic error there), since Google's own OAuth
    // already proved they own this email address.
    if (!isGoogleLinked && hasRealPassword) {
      console.log('[OAuth:callback] existing admin uses password auth, Google not linked → rejecting Google sign-in');
      // Don't leave the just-established Supabase session active for an
      // account the person hasn't actually authenticated into at the app level.
      await supabase.auth.signOut();
      const response = NextResponse.redirect(`${origin}/login?error=wrong-auth-method`);
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
      });
      return response;
    }

    // Self-heal: backfill google_linked for rows that predate the column
    // (sentinel-fallback case), and complete a first-ever Google sign-in on
    // an account that was created with no password at all (empty hash).
    // Must be awaited — on serverless this function can be frozen the
    // instant the redirect response is sent, silently dropping a
    // fire-and-forget write and leaving google_linked stuck at false forever
    // (Settings then perpetually shows "Connect Google" for an account
    // that's actively signed in via Google).
    const updates: Record<string, unknown> = {};
    if (!rawGoogleLinked) updates.google_linked = true;
    if (!sentinelMatch && !hasRealPassword) updates.password_hash = 'google_oauth';
    if (Object.keys(updates).length > 0) {
      const table = existingAccount.role === 'super_admin' ? 'admins' : 'commissioners';
      const { error: selfHealError } = await serviceClient.from(table).update(updates).eq('id', existingAdmin.id);
      if (selfHealError) debugError('[OAuth:callback] google_linked self-heal failed:', selfHealError);
    }

    console.log('[OAuth:callback] existing account → building session redirect');
    return buildSessionRedirect(origin, { ...existingAdmin, is_super_admin: existingAccount.role === 'super_admin' }, pendingCookies, request);
  }

  // New account — check intent cookie
  const intent = request.cookies.get('oauth_intent')?.value;
  // Set alongside oauth_intent by the register page when a plan was chosen
  // on /pricing — see src/app/register/page.tsx. Same rule as the
  // email/password path in create-commissioner/route.ts: only 'standard' is
  // an explicit trial opt-in, anything else is a plain Free account.
  const planIntent = request.cookies.get('oauth_plan')?.value;
  console.log('[OAuth:callback] no existing admin — oauth_intent cookie:', intent ?? 'NOT SET', '| oauth_plan cookie:', planIntent ?? 'NOT SET');

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
      google_linked: true,
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

  // Non-critical: set plan fields. plan stays 'free' either way — an active
  // trial is derived from trial_ends_at at read time, never stored as
  // separate state (see computePlanInfo in src/lib/plan.ts).
  const wantsTrial = planIntent === 'standard' && isTrialEnabled();
  void serviceClient.from('commissioners')
    .update({ plan: 'free', trial_ends_at: wantsTrial ? trialEndDate(TRIAL_DAYS) : null })
    .eq('id', newCommissioner.id);

  // Non-critical: send welcome email. Direct call rather than a self-fetch
  // to a separate API route — that route had no caller-auth check, so it
  // was reachable by anyone to send arbitrary "your account is ready"
  // emails to any address; inlining the call removes that public surface
  // instead of adding an internal-only auth scheme for a same-origin call.
  emailService
    .sendAdminCreationNotification(newCommissioner.email, newCommissioner.full_name ?? newCommissioner.email)
    .catch(() => {});

  // Chose Standard with no trial running — there was nothing to grant at
  // account-creation time (plan stayed Free), so the only way "Standard"
  // means anything here is to continue straight into Stripe checkout
  // instead of landing on the dashboard. Mirrors the email/password path in
  // src/app/register/page.tsx.
  const wantsCheckoutAfterSignup = planIntent === 'standard' && !wantsTrial;

  console.log('[OAuth:callback] new commissioner created → building session redirect');
  return buildSessionRedirect(origin, { ...newCommissioner, is_super_admin: false }, pendingCookies, request, {
    clearIntent: true,
    destinationPath: wantsCheckoutAfterSignup ? '/upgrade' : undefined,
  });
}

function buildSessionRedirect(
  origin: string,
  admin: { id: string; email: string; full_name: string | null; is_super_admin: boolean },
  pendingCookies: { name: string; value: string; options: Record<string, unknown> }[],
  request: NextRequest,
  opts: { clearIntent?: boolean; destinationPath?: string } = {}
) {
  const { clearIntent = false, destinationPath } = opts;
  const destination = admin.is_super_admin
    ? `${origin}/admin/dashboard`
    : `${origin}${destinationPath ?? '/dashboard'}`;

  console.log('[OAuth:buildSessionRedirect] admin:', admin.email, '| is_super_admin:', admin.is_super_admin, '| destination:', destination, '| pendingCookies:', pendingCookies.length);

  const response = NextResponse.redirect(destination);

  // Hand session to the browser via a non-httpOnly cookie so AuthProvider can read it.
  // is_super_admin is intentionally omitted — authorization must always be verified
  // against the database (via verifyAdminStatus) and never trusted from client storage.
  // This is a one-time handoff, not the real session: AuthProvider.checkSession()
  // consumes it on the very next page load and deletes it immediately, copying the
  // data into localStorage. maxAge is kept short (not the 90-day session lifetime)
  // so that if the client never runs that JS (JS disabled, tab closed before
  // hydration), this non-httpOnly PII cookie doesn't linger for months — the actual
  // persistent session is the httpOnly `sh-session` cookie set below.
  const sessionPayload = JSON.stringify({
    id: admin.id,
    email: admin.email,
    full_name: admin.full_name,
    signedInAt: Date.now(),
  });
  console.log('[OAuth:buildSessionRedirect] session cookie payload (no is_super_admin):', { id: admin.id, email: admin.email });

  response.cookies.set('nfl-pool-session', sessionPayload, {
    path: '/',
    maxAge: 60, // one-time handoff window, not a session lifetime
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
    response.cookies.delete('oauth_plan');
  }

  return response;
}

// Handles "Connect Google" initiated from an already-authenticated session
// (Account Settings → Authentication). Deliberately never touches
// nfl-pool-session/sh-session — those keep authorizing whoever was already
// logged in; this only ever flips google_linked on that same row after
// verifying Google's own OAuth confirmed the SAME email.
async function handleLinkIntent(
  googleEmail: string,
  origin: string,
  request: NextRequest,
  supabase: SupabaseClient,
  pendingCookies: { name: string; value: string; options: Record<string, unknown> }[]
) {
  // The transient Supabase Auth session this OAuth round-trip just created
  // is never the app's real session — always drop it, whatever happens below.
  await supabase.auth.signOut();

  const respond = (path: string) => {
    const response = NextResponse.redirect(`${origin}${path}`);
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
    });
    response.cookies.delete('oauth_intent');
    return response;
  };

  const sessionAdminId = request.cookies.get('sh-session')?.value;
  if (!sessionAdminId) {
    console.log('[OAuth:link] no sh-session cookie → not logged in, redirecting to login');
    return respond('/login?error=no-account');
  }

  const account = await findAccountById(sessionAdminId, { activeOnly: true });
  if (!account) {
    console.log('[OAuth:link] sh-session id does not resolve to an active account');
    return respond('/login?error=no-account');
  }

  // Require the Google account to match the currently logged-in account's
  // own email — the only unambiguous, no-account-enumeration way to prove
  // "this Google identity belongs to me" rather than letting a session
  // silently claim an unrelated email.
  if (account.row.email.toLowerCase() !== googleEmail.toLowerCase()) {
    console.log('[OAuth:link] Google email does not match session account email → rejecting');
    return respond('/admin/account?error=google-email-mismatch');
  }

  const serviceClient = getSupabaseServiceClient();
  const table = account.role === 'super_admin' ? 'admins' : 'commissioners';
  const { error } = await serviceClient.from(table).update({ google_linked: true }).eq('id', sessionAdminId);

  if (error) {
    debugError('[OAuth:link] failed to set google_linked:', error);
    return respond('/admin/account?error=google-link-failed');
  }

  console.log('[OAuth:link] Google linked for', account.row.email);
  return respond('/admin/account?linked=google');
}
