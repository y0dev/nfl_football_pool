import { NextRequest, NextResponse } from 'next/server';
import { getOverrideEligibility } from '@/lib/season-status';
import { debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const week = Number(searchParams.get('week'));
    const seasonType = Number(searchParams.get('seasonType'));

    if (!poolId || !week || !seasonType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const eligibility = await getOverrideEligibility(poolId, week, seasonType);
    return NextResponse.json({ success: true, ...eligibility });
  } catch (error) {
    debugError('Error in override-eligibility API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
