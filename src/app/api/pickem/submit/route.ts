import { NextRequest, NextResponse } from 'next/server';
import { submitPickemPick } from '@/lib/pickem';
import { isDummyData, simulatePicksEnabled, debugError } from '@/lib/utils';

// Pick'em's equivalent of /api/picks/submit — one game at a time (not
// Confidence's atomic whole-week submit), so individual games can lock
// independently as their own kickoff passes. All real validation (week-open
// window, per-game lock) lives in submitPickemPick() (src/lib/pickem.ts).
export async function POST(request: NextRequest) {
  try {
    if (isDummyData() || simulatePicksEnabled()) {
      return NextResponse.json({ success: true, message: 'Pick submitted (simulated — not written to the database)' });
    }

    const body = await request.json().catch(() => ({}));
    const { participantId, poolId, gameId, selectedTeam, submittedBy } = body as {
      participantId?: string; poolId?: string; gameId?: string; selectedTeam?: string; submittedBy?: string;
    };

    if (!participantId || !poolId || !gameId || !selectedTeam) {
      return NextResponse.json({ success: false, error: 'participantId, poolId, gameId, and selectedTeam are all required.' }, { status: 400 });
    }

    const result = await submitPickemPick({ participantId, poolId, gameId, selectedTeam, submittedBy });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    debugError("Pick'em pick submit error:", error);
    return NextResponse.json({ success: false, error: 'Failed to submit pick. Please try again.' }, { status: 500 });
  }
}
