'use client';

import { useEffect, useState } from 'react';
import type { PoolStart } from './pool-start';

/**
 * The pool's first week (GET /api/pools/[id]/start-week), for limiting week
 * pickers and prev navigation. Null while loading, on error, or when the
 * season has no games yet — callers then show every week, as before.
 */
export function usePoolStartWeek(poolId: string | null | undefined): PoolStart | null {
  const [result, setResult] = useState<{ poolId: string; start: PoolStart | null } | null>(null);
  useEffect(() => {
    if (!poolId) return;
    let cancelled = false;
    fetch(`/api/pools/${encodeURIComponent(poolId)}/start-week`)
      .then(res => res.json())
      .then(body => { if (!cancelled) setResult({ poolId, start: body?.success ? body.start ?? null : null }); })
      .catch(() => { if (!cancelled) setResult({ poolId, start: null }); });
    return () => { cancelled = true; };
  }, [poolId]);
  return result && result.poolId === poolId ? result.start : null;
}
