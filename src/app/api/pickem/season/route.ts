import { NextRequest, NextResponse } from 'next/server';
import { computePickemSeasonSummary } from '@/lib/pickem';
import { checkPoolAccessFromRequest } from '@/lib/pool-access';
import { debugError } from '@/lib/utils';

// Read-only season-summary endpoint for a Pick'em pool. Single source of
// truth is computePickemSeasonSummary() in src/lib/pickem.ts.
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

    const summary = await computePickemSeasonSummary(poolId);
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    debugError("Pick'em season summary error:", error);
    return NextResponse.json({ success: false, error: "Failed to load Pick'em season summary" }, { status: 500 });
  }
}
