'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldOff } from 'lucide-react';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { loadOwnedHuddleForCommissioner } from '@/actions/huddles';
import { HuddleRecord } from '@/lib/huddles';
import { LeagueManager } from '@/components/league/league-manager';
import { debugError } from '@/lib/utils';

const bg      = 'oklch(13% 0.025 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;

function HuddleContent() {
  const params = useParams();
  const huddleId = params.huddleId as string;
  const { user } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [huddle, setHuddle] = useState<HuddleRecord | null>(null);

  useEffect(() => {
    if (!user?.email || !huddleId) return;
    loadOwnedHuddleForCommissioner(huddleId, user.email)
      .then(setHuddle)
      .catch(err => debugError('Failed to load Huddle:', err))
      .finally(() => setIsLoading(false));
  }, [huddleId, user?.email]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  if (!huddle) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, padding: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <ShieldOff style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
          <p style={{ ...bc, fontWeight: 700, fontSize: '1rem', color: textMid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Huddle not found
          </p>
          <button
            onClick={() => router.push('/league')}
            style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <ArrowLeft style={{ width: 12, height: 12 }} /> Back to My Huddles
          </button>
        </div>
      </div>
    );
  }

  return (
    <LeagueManager
      huddleId={huddle.id}
      initialName={huddle.name}
      onBack={() => router.push('/league')}
      backLabel="My Huddles"
    />
  );
}

export default function HuddlePage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <HuddleContent />
      </AdminGuard>
    </AuthProvider>
  );
}
