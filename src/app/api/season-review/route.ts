import { NextRequest, NextResponse } from 'next/server';
import { computeSeasonReview } from '@/lib/season-review';
import { debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = searchParams.get('season');

    if (!poolId || !season) {
      return NextResponse.json({ error: 'Pool ID and season are required' }, { status: 400 });
    }

    const data = await computeSeasonReview(poolId, parseInt(season));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    debugError('Error in season review API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
