'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, AuthProvider } from '@/lib/auth';
import { BrandLogo } from '@/components/ui/brand-logo';
import { createPageUrl } from '@/lib/utils';

const bg      = 'oklch(13% 0.025 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const errRed  = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signIn } = useAuth();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const next = searchParams.get('next');

      if (!code) {
        setErrorMsg('No authorization code received from Google.');
        setStatus('error');
        return;
      }

      try {
        const { getSupabaseClient, getSupabaseServiceClient } = await import('@/lib/supabase');
        const supabase = getSupabaseClient();

        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
        if (sessionError || !sessionData.session) {
          console.error('[auth/callback] exchangeCodeForSession error:', sessionError);
          setErrorMsg('Failed to complete Google sign-in. Please try again.');
          setStatus('error');
          return;
        }

        const email = sessionData.session.user.email;
        const fullName =
          sessionData.session.user.user_metadata?.full_name ??
          sessionData.session.user.user_metadata?.name ??
          null;

        if (!email) {
          setErrorMsg('Could not retrieve your email from Google. Please try again.');
          setStatus('error');
          return;
        }

        const serviceClient = getSupabaseServiceClient();
        const { data: existingAdmin } = await serviceClient
          .from('admins')
          .select('id, email, full_name, is_super_admin')
          .eq('email', email)
          .eq('is_active', true)
          .single();

        if (existingAdmin) {
          await signIn({
            id: existingAdmin.id,
            email: existingAdmin.email,
            full_name: existingAdmin.full_name ?? undefined,
            is_super_admin: existingAdmin.is_super_admin,
          });
          window.location.href = existingAdmin.is_super_admin
            ? createPageUrl('admindashboard')
            : createPageUrl('dashboard');
          return;
        }

        if (next === 'register') {
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
            const isDuplicate = createError?.message?.includes('duplicate') || createError?.code === '23505';
            setErrorMsg(isDuplicate
              ? 'An account with this email already exists. Please sign in instead.'
              : 'Failed to create your commissioner account. Please try again.');
            setStatus('error');
            return;
          }

          // Set plan fields — non-critical, silently skipped if columns don't exist yet
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + 14);
          void serviceClient.from('admins')
            .update({ plan: 'free', trial_ends_at: trialEndsAt.toISOString() })
            .eq('id', newAdmin.id);

          // Send welcome email — non-critical
          fetch('/api/admin/welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: newAdmin.email, fullName: newAdmin.full_name ?? newAdmin.email }),
          }).catch(() => {});

          await signIn({
            id: newAdmin.id,
            email: newAdmin.email,
            full_name: newAdmin.full_name ?? undefined,
            is_super_admin: newAdmin.is_super_admin,
          });
          window.location.href = createPageUrl('dashboard');
          return;
        }

        setErrorMsg('No commissioner account found for this Google account. Please register first or use a different sign-in method.');
        setStatus('error');
      } catch (err) {
        console.error('OAuth callback error:', err);
        setErrorMsg('An unexpected error occurred. Please try again.');
        setStatus('error');
      }
    };

    handleCallback();
  }, [searchParams, signIn]);

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{
        background: card, border: `1px solid ${border}`,
        borderTop: `3px solid ${green}`, borderRadius: 10,
        padding: '2.5rem', maxWidth: 400, width: '100%', textAlign: 'center',
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <BrandLogo variant="icon" size={48} />
        </div>

        {status === 'loading' ? (
          <>
            <div style={{
              width: 36, height: 36,
              border: `3px solid ${border}`, borderTopColor: greenHi,
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1.25rem',
            }} />
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.22em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Completing Sign-In
            </p>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid }}>
              Verifying your Google account...
            </p>
          </>
        ) : (
          <>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.22em', color: errRed, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Sign-In Failed
            </p>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, lineHeight: 1.6, marginBottom: '1.75rem' }}>
              {errorMsg}
            </p>
            <button
              onClick={() => router.push(createPageUrl('login'))}
              style={{
                padding: '0.65rem 1.5rem',
                background: green, color: text,
                border: 'none', borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.82rem',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Back to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CallbackPage() {
  return (
    <AuthProvider>
      <Suspense fallback={
        <div style={{ minHeight: '100vh', background: 'oklch(13% 0.025 255)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid oklch(26% 0.03 255)', borderTopColor: 'oklch(59% 0.15 155)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      }>
        <CallbackContent />
      </Suspense>
    </AuthProvider>
  );
}

export default CallbackPage;
