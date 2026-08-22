'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Footer } from '@/components/layout/Footer';
import { PoolPicksContent } from '@/components/picks/pool-picks-content';
import { SurvivorPicksContent } from '@/components/picks/survivor-picks-content';
import { PickemPicksContent } from '@/components/picks/pickem-picks-content';
import { debugError } from '@/lib/utils';

const bg = 'oklch(13% 0.025 255)';

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'oklch(20% 0.03 255)', border: '1px solid oklch(26% 0.03 255)', borderRadius: 10, padding: '2rem', width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid oklch(46% 0.14 155)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
        <p style={{ fontFamily: 'var(--font-barlow)', color: 'oklch(72% 0.015 255)', fontSize: '0.9rem' }}>Loading…</p>
      </div>
    </div>
  );
}

// Branches to the right Picks experience for this pool's competition_type
// before either component ever mounts — a Survivor pool must never render
// even a flash of the Confidence UI (confidence points, Q1-Q4 info), and
// vice versa. PoolPicksContent (Confidence) is completely untouched by
// this change; it's rendered exactly as it always was for any pool that
// isn't competition_type === 'SURVIVOR'.
function PicksRouter() {
  const params = useParams();
  const poolId = params.id as string;
  const [competitionType, setCompetitionType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadPoolType = async () => {
      try {
        const res = await fetch(`/api/pools/${poolId}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load pool');
        if (!cancelled) setCompetitionType(data.pool?.competition_type ?? null);
      } catch (error) {
        debugError('Error loading pool competition type:', error);
        // No silent Confidence fallback — a genuine fetch failure (private
        // pool access denied, pool not found) should surface as "unable to
        // load," never render whichever pool-type UI happens to be default.
        if (!cancelled) setCompetitionType(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (poolId) loadPoolType();
    return () => { cancelled = true; };
  }, [poolId]);

  if (loading) return <LoadingScreen />;

  if (competitionType === 'SURVIVOR') {
    return (
      <>
        <SurvivorPicksContent />
        <Footer pageName="Survivor Pick" />
      </>
    );
  }

  if (competitionType === 'PICKEM') {
    return (
      <>
        <PickemPicksContent />
        <Footer pageName="Pick'em Pick" />
      </>
    );
  }

  if (competitionType === 'NFL_CONFIDENCE') {
    return (
      <>
        <PoolPicksContent />
        <Footer pageName="Pick Selection" />
      </>
    );
  }

  // Every explicitly-handled type is listed above — reaching here means
  // either the fetch failed (competitionType null) or the pool is a type
  // with no Picks UI built yet (NCAA_CONFIDENCE, MARCH_MADNESS). Never fall
  // through to the Confidence experience by default.
  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'oklch(20% 0.03 255)', border: '1px solid oklch(26% 0.03 255)', borderRadius: 10, padding: '2rem', width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-barlow)', color: 'oklch(72% 0.015 255)', fontSize: '0.9rem' }}>
          {competitionType ? "This pool's type isn't supported yet." : "Couldn't load this pool. Try again."}
        </p>
      </div>
    </div>
  );
}

export default function PoolPicksPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PicksRouter />
    </Suspense>
  );
}
