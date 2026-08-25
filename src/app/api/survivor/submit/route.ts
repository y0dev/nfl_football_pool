import { NextRequest, NextResponse } from 'next/server';
import { submitSurvivorPick } from '@/lib/survivor';
import { checkPoolAccessFromRequest } from '@/lib/pool-access';
import { isDummyData, simulatePicksEnabled, debugError } from '@/lib/utils';

// Survivor's equivalent of /api/picks/submit — thin route, all real
// validation (eliminated/winner lockout, week-lock, team reuse) lives in
// submitSurvivorPick() (src/lib/survivor.ts), the single authoritative
// place that logic exists.
export async function POST(request: NextRequest) {
  try {
    if (isDummyData() || simulatePicksEnabled()) {
      return NextResponse.json({ success: true, message: 'Pick submitted (simulated — not written to the database)' });
    }

    const body = await request.json().catch(() => ({}));
    const { participantId, poolId, gameId, selectedTeam, submittedBy, devForceUnlock } = body as {
      participantId?: string; poolId?: string; gameId?: string; selectedTeam?: string; submittedBy?: string; devForceUnlock?: boolean;
    };

    if (!participantId || !poolId || !gameId || !selectedTeam) {
      return NextResponse.json({ success: false, error: 'participantId, poolId, gameId, and selectedTeam are all required.' }, { status: 400 });
    }

    const access = await checkPoolAccessFromRequest(poolId, request);
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const result = await submitSurvivorPick({ participantId, poolId, gameId, selectedTeam, submittedBy, devForceUnlock });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    debugError('Survivor pick submit error:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit pick. Please try again.' }, { status: 500 });
  }
}
