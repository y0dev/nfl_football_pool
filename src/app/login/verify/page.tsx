'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth, AuthProvider } from '@/lib/auth';
import { verifyMagicLink } from '@/actions/magicLink';
import { createPageUrl } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/brand-logo';
import Link from 'next/link';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const errRed  = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

type Status = 'verifying' | 'success' | 'expired' | 'error';

function VerifyContent() {
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No magic link token found. Please request a new one.');
      return;
    }

    let cancelled = false;

    verifyMagicLink(token).then(async (result) => {
      if (cancelled) return;

      if (result.success && result.user) {
        try {
          await signIn(result.user);
          setStatus('success');
          setTimeout(() => {
            if (cancelled) return;
            if (result.user!.is_super_admin) {
              window.location.href = createPageUrl('admindashboard');
            } else {
              window.location.href = createPageUrl('dashboard');
            }
          }, 1500);
        } catch {
          setStatus('error');
          setErrorMsg('Session creation failed. Please try signing in again.');
        }
      } else if (result.expired) {
        setStatus('expired');
      } else {
        setStatus('error');
        setErrorMsg(result.error || 'This magic link is invalid.');
      }
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>

      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', marginBottom: '2.5rem' }}>
        <BrandLogo variant="horizontal" size={60} />
      </Link>

      {/* Card */}
      <div style={{
        background: card,
        border: `1px solid ${border}`,
        borderTop: `3px solid ${status === 'error' || status === 'expired' ? errRed : green}`,
        borderRadius: 10,
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: 400,
        textAlign: 'center',
      }}>

        {status === 'verifying' && (
          <>
            <div style={{ width: 48, height: 48, margin: '0 auto 1.5rem', borderRadius: '50%', border: `3px solid oklch(26% 0.03 255)`, borderTopColor: green, animation: 'spin 0.8s linear infinite' }} />
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.22em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Verifying
            </p>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1 }}>
              Signing You In
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textDim, marginTop: '0.75rem' }}>
              Verifying your magic link...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ width: 48, height: 48, margin: '0 auto 1.5rem', borderRadius: '50%', background: `oklch(46% 0.14 155 / 0.15)`, border: `1px solid oklch(46% 0.14 155 / 0.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={greenHi} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.22em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Verified
            </p>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1 }}>
              Welcome Back
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textDim, marginTop: '0.75rem' }}>
              Redirecting to your dashboard...
            </p>
          </>
        )}

        {status === 'expired' && (
          <>
            <div style={{ width: 48, height: 48, margin: '0 auto 1.5rem', borderRadius: '50%', background: `oklch(62% 0.22 25 / 0.12)`, border: `1px solid oklch(62% 0.22 25 / 0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={errRed} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.22em', color: errRed, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Expired
            </p>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1 }}>
              Link Expired
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginTop: '0.75rem', marginBottom: '1.5rem' }}>
              Magic links expire after 15 minutes. Request a new one to sign in.
            </p>
            <Link
              href="/login"
              style={{
                display: 'inline-block', padding: '0.7rem 1.5rem',
                background: green, color: text, textDecoration: 'none',
                borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.82rem',
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}
            >
              Request New Link
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ width: 48, height: 48, margin: '0 auto 1.5rem', borderRadius: '50%', background: `oklch(62% 0.22 25 / 0.12)`, border: `1px solid oklch(62% 0.22 25 / 0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={errRed} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.22em', color: errRed, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Invalid Link
            </p>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1 }}>
              Sign-In Failed
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginTop: '0.75rem', marginBottom: '1.5rem' }}>
              {errorMsg}
            </p>
            <Link
              href="/login"
              style={{
                display: 'inline-block', padding: '0.7rem 1.5rem',
                background: green, color: text, textDecoration: 'none',
                borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.82rem',
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}
            >
              Back to Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <AuthProvider>
      <Suspense fallback={
        <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid oklch(26% 0.03 255)`, borderTopColor: green, animation: 'spin 0.8s linear infinite' }} />
        </div>
      }>
        <VerifyContent />
      </Suspense>
    </AuthProvider>
  );
}
