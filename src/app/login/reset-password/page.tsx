'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { parseResetToken, resetPasswordWithToken } from '@/actions/passwordReset';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Footer } from '@/components/layout/Footer';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
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

type PageState = 'form' | 'success' | 'expired' | 'invalid';

function PasswordInput({ value, onChange, placeholder, autoComplete }: { value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        style={{ display: 'block', width: '100%', padding: '0.55rem 0.75rem', paddingRight: '2.75rem', borderRadius: 6, boxSizing: 'border-box', ...b, fontSize: '0.875rem', background: bg, border: `1px solid ${border}`, color: text }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 0.75rem', background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        {show ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
      </button>
    </div>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [pageState, setPageState] = useState<PageState>('form');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setPageState('invalid'); return; }
    parseResetToken(token).then(({ valid, expired }) => {
      if (expired) setPageState('expired');
      else if (!valid) setPageState('invalid');
    });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) { setError("Passwords don't match"); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }

    setIsLoading(true);
    try {
      const result = await resetPasswordWithToken(token, newPassword);
      if (result.success) {
        setPageState('success');
      } else if (result.expired) {
        setPageState('expired');
      } else {
        setError(result.error || 'Failed to reset password. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const borderTopColor = pageState === 'success' ? green : pageState === 'form' ? green : errRed;

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>

      <Link href="/" style={{ textDecoration: 'none', marginBottom: '2.5rem' }}>
        <BrandLogo variant="horizontal" size={60} />
      </Link>

      <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${borderTopColor}`, borderRadius: 10, padding: '2.5rem 2rem', width: '100%', maxWidth: 420 }}>

        {pageState === 'form' && (
          <>
            <div style={{ marginBottom: '1.75rem' }}>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Commissioner Access
              </p>
              <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1 }}>
                New Password
              </h1>
              <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginTop: '0.5rem' }}>
                Choose a strong password for your account
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                  New Password
                </label>
                <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" autoComplete="new-password" />
              </div>
              <div>
                <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                  Confirm Password
                </label>
                <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat new password" autoComplete="new-password" />
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.7rem 0.9rem', background: 'oklch(62% 0.22 25 / 0.1)', border: '1px solid oklch(62% 0.22 25 / 0.4)', borderRadius: 6 }}>
                  <AlertCircle style={{ width: 15, height: 15, color: errRed, flexShrink: 0, marginTop: 1 }} />
                  <p style={{ ...b, fontSize: '0.8rem', color: errRed, margin: 0 }}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !newPassword || !confirmPassword}
                style={{ width: '100%', padding: '0.75rem 1rem', background: isLoading || !newPassword || !confirmPassword ? 'oklch(35% 0.08 155)' : green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: isLoading || !newPassword || !confirmPassword ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isLoading
                  ? <><span style={{ width: 14, height: 14, border: '2px solid oklch(50% 0.08 155)', borderTopColor: text, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Saving…</>
                  : 'Set New Password'}
              </button>
            </form>
          </>
        )}

        {pageState === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, margin: '0 auto 1.5rem', borderRadius: '50%', background: 'oklch(46% 0.14 155 / 0.15)', border: '1px solid oklch(46% 0.14 155 / 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 style={{ width: 22, height: 22, color: greenHi }} />
            </div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Done
            </p>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1, marginBottom: '0.85rem' }}>
              Password Updated
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1.75rem' }}>
              Your password has been reset. You can now sign in with your new password.
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
              This reset link has expired. Request a new one to continue.
            </p>
            <Link
              href="/login/forgot-password"
              style={{ display: 'inline-block', padding: '0.7rem 1.5rem', background: green, color: text, textDecoration: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Request New Link
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
              This reset link is invalid or has already been used.
            </p>
            <Link
              href="/login/forgot-password"
              style={{ display: 'inline-block', padding: '0.7rem 1.5rem', background: green, color: text, textDecoration: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Request New Link
            </Link>
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <Footer />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthProvider>
      <Suspense fallback={
        <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid oklch(26% 0.03 255)`, borderTopColor: 'oklch(46% 0.14 155)', animation: 'spin 0.8s linear infinite' }} />
        </div>
      }>
        <ResetPasswordContent />
      </Suspense>
    </AuthProvider>
  );
}
