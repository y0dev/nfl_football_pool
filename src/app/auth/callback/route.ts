import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseRouteClient } from '@/lib/supabase-ssr';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no-code`);
  }

  // Capture cookies Supabase wants to set so we can apply them to the response
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = await getSupabaseRouteClient(
    request.cookies,
    (c) => pendingCookies.push(...c)
  );

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.session) {
    debugError('[SH][AUTH][OAUTH] exchangeCodeForSession failed:', exchangeError);
    return NextResponse.redirect(`${origin}/login?error=oauth-failed`);
  }

  const email = data.session.user.email;
  const fullName =
    data.session.user.user_metadata?.full_name ??
    data.session.user.user_metadata?.name ??
    null;

  if (!email) {
    return NextResponse.redirect(`${origin}/login?error=no-email`);
  }

  const serviceClient = getSupabaseServiceClient();

  // Check for existing admin
  const { data: existingAdmin } = await serviceClient
    .from('admins')
    .select('id, email, full_name, is_super_admin')
    .eq('email', email)
    .eq('is_active', true)
    .single();

  if (existingAdmin) {
    return buildSessionRedirect(origin, existingAdmin, pendingCookies, request);
  }

  // New account — check intent cookie
  const intent = request.cookies.get('oauth_intent')?.value;

  if (intent !== 'register') {
    return NextResponse.redirect(
      `${origin}/login?error=no-account`
    );
  }

  const { data: newAdmin, error: createError } = await serviceClient
    .from('admins')
    .insert({
      email,
      password_hash: 'google_oauth',
      full_name: fullName,
      is_super_admin: false,
      is_active: true,
    })
    .select('id, email, full_name, is_super_admin')
    .single();

  if (createError || !newAdmin) {
    debugError('[SH][AUTH][OAUTH] Admin insert failed:', createError);
    const isDuplicate = createError?.code === '23505';
    return NextResponse.redirect(
      `${origin}/login?error=${isDuplicate ? 'duplicate-account' : 'create-failed'}`
    );
  }

  // Non-critical: set plan fields
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);
  void serviceClient.from('admins')
    .update({ plan: 'free', trial_ends_at: trialEndsAt.toISOString() })
    .eq('id', newAdmin.id);

  // Non-critical: send welcome email
  fetch(`${origin}/api/admin/welcome-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: newAdmin.email, fullName: newAdmin.full_name ?? newAdmin.email }),
  }).catch(() => {});

  return buildSessionRedirect(origin, newAdmin, pendingCookies, request, true);
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

  const response = NextResponse.redirect(destination);

  // Hand session to the browser via a non-httpOnly cookie so AuthProvider can read it
  const sessionPayload = JSON.stringify({
    id: admin.id,
    email: admin.email,
    full_name: admin.full_name,
    is_super_admin: admin.is_super_admin,
    signedInAt: Date.now(),
  });

  response.cookies.set('nfl-pool-session', sessionPayload, {
    path: '/',
    maxAge: 90 * 24 * 60 * 60,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false, // must be readable by JS in AuthProvider
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
