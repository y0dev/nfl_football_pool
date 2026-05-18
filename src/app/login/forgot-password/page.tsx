'use client';

import { useState } from 'react';
import { AuthProvider } from '@/lib/auth';
import { requestPasswordReset } from '@/actions/passwordReset';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Footer } from '@/components/layout/Footer';
import { AlertCircle, Mail } from 'lucide-react';
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

function ForgotPasswordContent() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await requestPasswordReset(email);
      if (result.success) {
        setSent(true);
      } else {
        setError(result.error || 'Failed to send reset email. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>

      <Link href="/" style={{ textDecoration: 'none', marginBottom: '2.5rem' }}>
        <BrandLogo variant="horizontal" size={60} />
      </Link>

      <div style={{
        background: card,
        border: `1px solid ${border}`,
        borderTop: `3px solid ${sent ? green : errRed}`,
        borderRadius: 10,
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: 420,
      }}>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, margin: '0 auto 1.5rem', borderRadius: '50%', background: 'oklch(46% 0.14 155 / 0.15)', border: '1px solid oklch(46% 0.14 155 / 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail style={{ width: 22, height: 22, color: greenHi }} />
            </div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Check Your Email
            </p>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1, marginBottom: '0.85rem' }}>
              Reset Link Sent
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, lineHeight: 1.6, marginBottom: '1.75rem' }}>
              If <strong style={{ color: text }}>{email}</strong> has an account, you'll receive a reset link shortly. It expires in 1 hour.
            </p>
            <Link
              href="/login"
              style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', color: greenHi, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '1.75rem' }}>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Commissioner Access
              </p>
              <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: text, textTransform: 'uppercase', lineHeight: 1 }}>
                Forgot Password
              </h1>
              <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginTop: '0.5rem' }}>
                Enter your email and we'll send a reset link
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="commissioner@example.com"
                  autoComplete="email"
                  autoFocus
                  required
                  style={{ display: 'block', width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, boxSizing: 'border-box', ...b, fontSize: '0.875rem', background: bg, border: `1px solid ${border}`, color: text }}
                />
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.7rem 0.9rem', background: 'oklch(62% 0.22 25 / 0.1)', border: '1px solid oklch(62% 0.22 25 / 0.4)', borderRadius: 6 }}>
                  <AlertCircle style={{ width: 15, height: 15, color: errRed, flexShrink: 0, marginTop: 1 }} />
                  <p style={{ ...b, fontSize: '0.8rem', color: errRed, margin: 0 }}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email}
                style={{ width: '100%', padding: '0.75rem 1rem', background: isLoading || !email ? 'oklch(35% 0.08 155)' : green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: isLoading || !email ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isLoading
                  ? <><span style={{ width: 14, height: 14, border: '2px solid oklch(50% 0.08 155)', borderTopColor: text, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Sending…</>
                  : 'Send Reset Link'}
              </button>

              <Link
                href="/login"
                style={{ ...b, fontSize: '0.8rem', color: textDim, textDecoration: 'none', textAlign: 'center' }}
              >
                Back to sign in
              </Link>
            </form>
          </>
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <Footer />
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthProvider>
      <ForgotPasswordContent />
    </AuthProvider>
  );
}
