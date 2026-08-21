import { NextRequest, NextResponse } from 'next/server';
import { computePickemWeekResult } from '@/lib/pickem';
import { checkPoolAccessFromRequest } from '@/lib/pool-access';
import { debugError } from '@/lib/utils';

// Read-only weekly-result endpoint for a Pick'em pool — the Picks page and
// the Pick'em leaderboard both call this rather than computing anything
// themselves. Single source of truth is computePickemWeekResult() in
// src/lib/pickem.ts.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const week = searchParams.get('week');
    const seasonType = searchParams.get('seasonType');
    if (!poolId || !week || !seasonType) {
      return NextResponse.json({ success: false, error: 'poolId, week, and seasonType are all required' }, { status: 400 });
    }

    const access = await checkPoolAccessFromRequest(poolId, request);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const result = await computePickemWeekResult(poolId, parseInt(week, 10), parseInt(seasonType, 10));
    return NextResponse.json({ success: true, result });
  } catch (error) {
    debugError("Pick'em week result error:", error);
    return NextResponse.json({ success: false, error: "Failed to load Pick'em week result" }, { status: 500 });
  }
}
