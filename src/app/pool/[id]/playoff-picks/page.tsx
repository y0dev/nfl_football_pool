'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
