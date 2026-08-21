import { NextRequest, NextResponse } from 'next/server';
import { submitPickemTiebreaker } from '@/lib/pickem';
import { isDummyData, simulatePicksEnabled, debugError } from '@/lib/utils';

// Submits (or updates) a participant's weekly tiebreaker prediction — the
// combined-score guess used only to break ties, never counted as a game
// pick and never added to the weekly score. All real validation lives in
// submitPickemTiebreaker() (src/lib/pickem.ts).
export async function POST(request: NextRequest) {
  try {
    if (isDummyData() || simulatePicksEnabled()) {
      return NextResponse.json({ success: true, message: 'Tiebreaker submitted (simulated — not written to the database)' });
    }

    const body = await request.json().catch(() => ({}));
    const { participantId, poolId, week, seasonType, predictedTotal, submittedBy } = body as {
      participantId?: string; poolId?: string; week?: number; seasonType?: number; predictedTotal?: number; submittedBy?: string;
    };

    if (!participantId || !poolId || !week || !seasonType || predictedTotal === undefined) {
      return NextResponse.json({ success: false, error: 'participantId, poolId, week, seasonType, and predictedTotal are all required.' }, { status: 400 });
    }

    const result = await submitPickemTiebreaker({ participantId, poolId, week, seasonType, predictedTotal, submittedBy });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    debugError("Pick'em tiebreaker submit error:", error);
    return NextResponse.json({ success: false, error: 'Failed to submit tiebreaker. Please try again.' }, { status: 500 });
  }
}
