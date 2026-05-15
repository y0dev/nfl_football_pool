'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

// Design tokens
const bg      = 'oklch(13% 0.025 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const textMid = 'oklch(72% 0.015 255)';

const b = { fontFamily: 'var(--font-barlow)' } as const;

/**
 * Redirect page for playoff-picks route
 * This page redirects to the picks page with seasonType=3
 * The 'round' query parameter is mapped to 'week'
 */
export default function PlayoffPicksRedirect() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const poolId = params.id as string;

  useEffect(() => {
    // Get round from URL parameter (default to 1 if not specified)
    const roundParam = searchParams?.get('round');
    const round = roundParam ? parseInt(roundParam, 10) : 1;

    // Validate round is 1-4, default to 1 if invalid
    const week = (round >= 1 && round <= 4) ? round : 1;

    // Preserve season parameter if present
    const seasonParam = searchParams?.get('season');
    const seasonQuery = seasonParam ? `&season=${seasonParam}` : '';

    // Redirect to picks page with seasonType=3
    const redirectUrl = `/pool/${poolId}/picks?week=${week}&seasonType=3${seasonQuery}`;
    router.replace(redirectUrl);
  }, [poolId, router, searchParams]);

  // Show loading state while redirecting
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${border}`, borderTopColor: green, animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
        <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Redirecting...</p>
      </div>
    </div>
  );
}
