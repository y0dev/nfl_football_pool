import { NextRequest, NextResponse } from 'next/server';
import { computeSurvivorPoolState } from '@/lib/survivor';
import { checkPoolAccessFromRequest } from '@/lib/pool-access';
import { debugError } from '@/lib/utils';

// Read-only status endpoint for a Survivor pool — the Picks page (used
// teams, my current status) and the Survivor leaderboard both call this
// rather than computing anything themselves. Single source of truth is
// computeSurvivorPoolState() in src/lib/survivor.ts.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    if (!poolId) {
      return NextResponse.json({ success: false, error: 'poolId is required' }, { status: 400 });
    }

    const access = await checkPoolAccessFromRequest(poolId, request);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const state = await computeSurvivorPoolState(poolId);
    return NextResponse.json({ success: true, state });
  } catch (error) {
    debugError('Survivor state error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load Survivor pool state' }, { status: 500 });
  }
}
