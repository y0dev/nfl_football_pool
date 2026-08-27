'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, AlertTriangle } from 'lucide-react';

const bg      = 'oklch(13% 0.025 255)';
const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const amber   = 'oklch(72% 0.16 60)';
const red     = 'oklch(60% 0.22 25)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface PoolPasswordPromptProps {
  poolId: string;
  poolName: string | null;
  /** Private pool exists but the commissioner hasn't configured a password
   * yet (legacy data) — there's nothing to enter, so show an
   * action-required message instead of a form (Step 24). */
  needsSetup: boolean;
  next?: string;
}

export function PoolPasswordPrompt({ poolId, poolName, needsSetup, next }: PoolPasswordPromptProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter the pool password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pools/${poolId}/verify-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(next && next.startsWith('/') ? next : `/pool/${poolId}/picks`);
        router.refresh();
      } else {
        setError(data.error || 'Incorrect password. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: needsSetup ? `${amber}18` : `${green}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
            {needsSetup
              ? <AlertTriangle style={{ width: 22, height: 22, color: amber }} />
              : <Lock style={{ width: 22, height: 22, color: green }} />}
          </div>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.15rem', color: text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {needsSetup ? 'Password Required' : 'Private Pool'}
          </h1>
          {poolName && (
            <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginTop: '0.3rem' }}>{poolName}</p>
          )}
        </div>

        {needsSetup ? (
          <p style={{ ...b, fontSize: '0.85rem', color: textMid, textAlign: 'center', lineHeight: 1.5 }}>
            This private pool needs a password before participants can access it. Ask your commissioner to set one from the pool&apos;s settings.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ ...b, fontSize: '0.85rem', color: textMid, textAlign: 'center', marginBottom: '0.25rem' }}>
              This pool is password protected.
            </p>
            <div>
              <label style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' }}>
                Pool Password
              </label>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                style={{ ...b, background: surface, border: `1px solid ${error ? red : border}`, color: text, padding: '0.6rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box', fontSize: '0.9rem' }}
              />
            </div>
            {error && (
              <p style={{ ...b, fontSize: '0.8rem', color: red }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.65rem', background: loading ? surface : green, color: loading ? textDim : text, border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.25rem' }}
            >
              {loading ? 'Checking…' : 'Enter Pool'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: `1px solid ${border}` }}>
          <Link
            href="/"
            style={{ ...b, fontSize: '0.82rem', color: textMid, textDecoration: 'none' }}
          >
            ← Back to Sunday Huddle
          </Link>
        </div>
      </div>
    </div>
  );
}
