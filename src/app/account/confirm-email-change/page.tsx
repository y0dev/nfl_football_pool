'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { getEmailChangeDetails, confirmEmailChange } from '@/actions/emailChange';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Footer } from '@/components/layout/Footer';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import Link from 'next/link';

const bg      = 'oklch(13% 0.025 255)';
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

type PageState = 'loading' | 'confirm' | 'confirming' | 'success' | 'expired' | 'invalid';

function ConfirmEmailChangeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setPageState('invalid'); return; }
    getEmailChangeDetails(token).then(details => {
      if (!details) { setPageState('invalid'); return; }
      setNewEmail(details.newEmail);
      setPageState('confirm');
    });
  }, [token]);

  const handleConfirm = async () => {
    setPageState('confirming');
    setError('');
    try {
      const result = await confirmEmailChange(token);
      if (result.success) {
        setPageState('success');
      } else if (result.expired) {
        setPageState('expired');
      } else {
        setError(result.error || 'Failed to confirm email change. Please try again.');
        setPageState('confirm');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setPageState('confirm');
    }
  };

  const borderTopColor = pageState === 'success' ? green : pageState === 'confirm' || pageState === 'confirming' || pageState === 'loading' ? green : errRed;

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>

      <Link href="/" style={{ textDecoration: 'none', marginBottom: '2.5rem' }}>
        <BrandLogo variant="horizontal" size={60} />
      </Link>

      <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${borderTopColor}`, borderRadius: 10, padding: '2.5rem 2rem', width: '100%', maxWidth: 440 }}>

        {pageState === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 0' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid oklch(26% 0.03 255)`, borderTopColor: green, animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {pageState === 'confirm' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ width: 52, height: 52, margin: '0 auto 1.25rem', borderRadius: '50%', background: 'oklch(46% 0.14 155 / 0.12)', border: `1px solid oklch(46% 0.14 155 / 0.35)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail style={{ width: 22, height: 22, color: greenHi }} />
              </div>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Confirm Change
              </p>
              <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1, marginBottom: '0.75rem' }}>
                Update Email
              </h1>
              <p style={{ ...b, fontSize: '0.875rem', color: textMid }}>
                Confirm your Sunday Huddle account email should change to:
              </p>
              {newEmail && (
                <p style={{ ...b, fontSize: '0.9rem', color: text, fontWeight: 700, marginTop: '0.35rem' }}>
                  {newEmail}
                </p>
              )}
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.7rem 0.9rem', background: 'oklch(62% 0.22 25 / 0.1)', border: `1px solid oklch(62% 0.22 25 / 0.4)`, borderRadius: 6, marginBottom: '1.25rem' }}>
                <AlertCircle style={{ width: 15, height: 15, color: errRed, flexShrink: 0, marginTop: 1 }} />
                <p style={{ ...b, fontSize: '0.8rem', color: errRed, margin: 0 }}>{error}</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                onClick={handleConfirm}
                style={{ width: '100%', padding: '0.8rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Confirm New Email
              </button>
              <Link
                href="/admin/account"
                style={{ display: 'block', width: '100%', padding: '0.7rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}
              >
                Cancel
              </Link>
            </div>
          </>
        )}

        {pageState === 'confirming' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', gap: '1rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid oklch(26% 0.03 255)`, borderTopColor: green, animation: 'spin 0.8s linear infinite' }} />
            <p style={{ ...b, fontSize: '0.875rem', color: textMid }}>Updating email…</p>
          </div>
        )}

        {pageState === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, margin: '0 auto 1.5rem', borderRadius: '50%', background: 'oklch(46% 0.14 155 / 0.15)', border: '1px solid oklch(46% 0.14 155 / 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 style={{ width: 22, height: 22, color: greenHi }} />
            </div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Email Updated
            </p>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1, marginBottom: '0.85rem' }}>
              All Set
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1.5rem' }}>
              Your account email is now <strong style={{ color: text }}>{newEmail}</strong>. Sign in with your new email from now on.
            </p>
            <Link
              href="/login"
              style={{ display: 'inline-block', padding: '0.7rem 1.5rem', background: green, color: text, textDecoration: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Sign In
            </Link>
          </div>
        )}

        {pageState === 'expired' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, margin: '0 auto 1.5rem', borderRadius: '50%', background: 'oklch(62% 0.22 25 / 0.12)', border: '1px solid oklch(62% 0.22 25 / 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle style={{ width: 22, height: 22, color: errRed }} />
            </div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.26em', color: errRed, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Expired
            </p>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1, marginBottom: '0.85rem' }}>
              Link Expired
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1.75rem' }}>
              This confirmation link has expired. Links are valid for 24 hours. Please request the email change again from your account settings.
            </p>
            <Link
              href="/admin/account"
              style={{ display: 'inline-block', padding: '0.7rem 1.5rem', background: green, color: text, textDecoration: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Back to Settings
            </Link>
          </div>
        )}

        {pageState === 'invalid' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, margin: '0 auto 1.5rem', borderRadius: '50%', background: 'oklch(62% 0.22 25 / 0.12)', border: '1px solid oklch(62% 0.22 25 / 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle style={{ width: 22, height: 22, color: errRed }} />
            </div>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1, marginBottom: '0.85rem' }}>
              Invalid Link
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1.75rem' }}>
              This confirmation link is invalid or has already been used.
            </p>
            <Link
              href="/"
              style={{ display: 'inline-block', padding: '0.7rem 1.5rem', background: green, color: text, textDecoration: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Go Home
            </Link>
          </div>
        )}

      </div>

      <div style={{ marginTop: '2rem' }}>
        <Footer />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function ConfirmEmailChangePage() {
  return (
    <AuthProvider>
      <Suspense fallback={
        <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid oklch(26% 0.03 255)`, borderTopColor: green, animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }>
        <ConfirmEmailChangeContent />
      </Suspense>
    </AuthProvider>
  );
}
