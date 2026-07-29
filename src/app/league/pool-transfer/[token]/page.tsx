'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Clock, ShieldOff, ArrowLeft } from 'lucide-react';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { confirmPoolTransfer } from '@/actions/poolTransfers';

const bg      = 'oklch(13% 0.025 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'waiting'; poolName: string; otherEmail: string }
  | { kind: 'completed'; poolName: string; removedFromSourceRoster: number };

function PoolTransferConfirmContent() {
  const params = useParams();
  const token = params.token as string;
  const { user } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<ViewState>({ kind: 'loading' });

  useEffect(() => {
    if (!user?.email || !token) return;
    confirmPoolTransfer(token, user.email).then(result => {
      if (!result.success) {
        setState({ kind: 'error', message: result.error });
      } else if (result.status === 'completed') {
        setState({ kind: 'completed', poolName: result.poolName, removedFromSourceRoster: result.removedFromSourceRoster });
      } else {
        setState({ kind: 'waiting', poolName: result.poolName, otherEmail: result.otherEmail });
      }
    });
  }, [token, user?.email]);

  const wrap = (icon: React.ReactNode, color: string, title: string, body: string) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 440, background: card, border: `1px solid ${border}`, borderTop: `3px solid ${color}`, borderRadius: 10, padding: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>{icon}</div>
        <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
          {title}
        </p>
        <p style={{ ...b, fontSize: '0.88rem', color: textMid, lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {body}
        </p>
        <button
          onClick={() => router.push('/league')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          <ArrowLeft style={{ width: 12, height: 12 }} /> My Huddles
        </button>
      </div>
    </div>
  );

  if (state.kind === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  if (state.kind === 'error') {
    return wrap(
      <ShieldOff style={{ width: 32, height: 32, color: liveRed, margin: '0 auto' }} />,
      liveRed,
      'Couldn’t Confirm Transfer',
      state.message
    );
  }

  if (state.kind === 'completed') {
    const rosterNote = state.removedFromSourceRoster > 0
      ? ` ${state.removedFromSourceRoster} participant(s) were also removed from the source League's roster.`
      : '';
    return wrap(
      <CheckCircle2 style={{ width: 32, height: 32, color: greenHi, margin: '0 auto' }} />,
      green,
      'Transfer Complete',
      `"${state.poolName}" and its participants have finished transferring. Both parties have been emailed a confirmation.${rosterNote}`
    );
  }

  return wrap(
    <Clock style={{ width: 32, height: 32, color: gold, margin: '0 auto' }} />,
    gold,
    'Confirmed — Waiting On the Other Party',
    `You've confirmed the transfer of "${state.poolName}". It'll complete once ${state.otherEmail} confirms their side too — as long as it still fits within their account's limits at that point.`
  );
}

export default function PoolTransferConfirmPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <PoolTransferConfirmContent />
      </AdminGuard>
    </AuthProvider>
  );
}
