'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { parseDeleteToken, confirmAccountDeletion, getAdminByDeletionToken } from '@/actions/accountDeletion';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Footer } from '@/components/layout/Footer';
import { AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
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

type PageState = 'loading' | 'confirm' | 'deleting' | 'success' | 'expired' | 'invalid';

function ConfirmDeletionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [accountEmail, setAccountEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setPageState('invalid'); return; }

    Promise.all([
      parseDeleteToken(token),
      getAdminByDeletionToken(token),
    ]).then(([parsed, admin]) => {
      if (parsed.expired) { setPageState('expired'); return; }
      if (!parsed.valid || !admin) { setPageState('invalid'); return; }
      setAccountEmail(admin.email);
      setPageState('confirm');
    });
  }, [token]);

  const handleConfirm = async () => {
    setPageState('deleting');
    setError('');
    try {
      const result = await confirmAccountDeletion(token);
      if (result.success) {
        setPageState('success');
        setTimeout(() => router.push('/'), 4000);
      } else if (result.expired) {
        setPageState('expired');
      } else {
        setError(result.error || 'Failed to delete account. Please try again.');
        setPageState('confirm');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setPageState('confirm');
    }
  };

  const borderTopColor =
    pageState === 'success' ? green :
    pageState === 'confirm' || pageState === 'deleting' || pageState === 'loading' ? errRed :
    errRed;

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>

      <Link href="/" style={{ textDecoration: 'none', marginBottom: '2.5rem' }}>
        <BrandLogo variant="horizontal" size={60} />
      </Link>

      <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${borderTopColor}`, borderRadius: 10, padding: '2.5rem 2rem', width: '100%', maxWidth: 440 }}>

        {pageState === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 0' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid oklch(26% 0.03 255)`, borderTopColor: errRed, animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {pageState === 'confirm' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ width: 52, height: 52, margin: '0 auto 1.25rem', borderRadius: '50%', background: 'oklch(62% 0.22 25 / 0.12)', border: `1px solid oklch(62% 0.22 25 / 0.35)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 style={{ width: 22, height: 22, color: errRed }} />
              </div>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.26em', color: errRed, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Permanent Action
              </p>
              <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1, marginBottom: '0.75rem' }}>
                Delete Account
              </h1>
              <p style={{ ...b, fontSize: '0.875rem', color: textMid }}>
                You are about to permanently delete the commissioner account for:
              </p>
              {accountEmail && (
                <p style={{ ...b, fontSize: '0.9rem', color: text, fontWeight: 700, marginTop: '0.35rem' }}>
                  {accountEmail}
                </p>
              )}
            </div>

            <div style={{ background: 'oklch(62% 0.22 25 / 0.08)', border: `1px solid oklch(62% 0.22 25 / 0.3)`, borderRadius: 8, padding: '1rem 1.15rem', marginBottom: '1.5rem' }}>
              <p style={{ ...b, fontSize: '0.82rem', color: 'oklch(75% 0.12 25)', margin: 0, lineHeight: 1.6 }}>
                <strong style={{ color: text }}>This cannot be undone.</strong> Your account will be permanently removed, along with any pools you created and all of their picks, scores, and participants. Pools created by other commissioners that you participate in are not affected.
              </p>
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
                style={{ width: '100%', padding: '0.8rem 1rem', background: errRed, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Trash2 style={{ width: 14, height: 14 }} />
                Yes, Delete My Account
              </button>
              <Link
                href="/admin/dashboard"
                style={{ display: 'block', width: '100%', padding: '0.7rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}
              >
                Cancel — Keep My Account
              </Link>
            </div>
          </>
        )}

        {pageState === 'deleting' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', gap: '1rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid oklch(26% 0.03 255)`, borderTopColor: errRed, animation: 'spin 0.8s linear infinite' }} />
            <p style={{ ...b, fontSize: '0.875rem', color: textMid }}>Deleting account…</p>
          </div>
        )}

        {pageState === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, margin: '0 auto 1.5rem', borderRadius: '50%', background: 'oklch(46% 0.14 155 / 0.15)', border: '1px solid oklch(46% 0.14 155 / 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 style={{ width: 22, height: 22, color: greenHi }} />
            </div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Account Deleted
            </p>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1, marginBottom: '0.85rem' }}>
              So Long, Commissioner
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1.5rem' }}>
              Your account has been permanently deleted. We&apos;re sorry to see you go. You&apos;ll receive a confirmation email shortly.
            </p>
            <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>
              Redirecting you home…
            </p>
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
              This confirmation link has expired. Links are valid for 24 hours. Please submit a new deletion request from your account settings.
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
              This deletion link is invalid or has already been used.
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

export default function ConfirmDeletionPage() {
  return (
    <AuthProvider>
      <Suspense fallback={
        <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid oklch(26% 0.03 255)`, borderTopColor: errRed, animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }>
        <ConfirmDeletionContent />
      </Suspense>
    </AuthProvider>
  );
}
