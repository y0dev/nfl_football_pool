import { NextRequest, NextResponse } from 'next/server';
import { computeSeasonReview } from '@/lib/season-review';
import { debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = searchParams.get('season');

    if (!poolId || !season) {
      return NextResponse.json(
        { error: 'Pool ID and season are required' },
        { status: 400 }
      );
    }

    // Delegates to the same centralized computation the Season Review tab
    // uses, rather than the old winner-calculator.ts implementation (which
    // used a different, superseded points-primary algorithm and cached
    // results that never invalidated).
    const review = await computeSeasonReview(poolId, parseInt(season));

    return NextResponse.json({
      success: true,
      seasonWinner: review.seasonWinner,
      runnerUp: review.runnerUp,
    });

  } catch (error) {
    debugError('Error in season winners API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
