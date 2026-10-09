import { Pick } from '@/types/game';
import { debugLog, debugError } from '@/lib/utils';

interface SaveDraftParams {
  participantId: string;
  poolId: string;
  week: number;
  season: number;
  seasonType: number;
  picks: Pick[];
  mondayNightScore?: number | null;
}

interface SaveDraftResult {
  success: boolean;
  error?: string;
}

// Fire-and-forget-ish helper called by pick-storage.ts's 2-minute inactivity
// timer — saves whatever the participant has selected so far as a draft a
// commissioner can review and submit on their behalf. Never the picks page's
// own real submit path (see submitPicks.ts) — this never touches `picks`.
export async function savePickDraft(params: SaveDraftParams): Promise<SaveDraftResult> {
  try {
    const response = await fetch('/api/picks/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const result = await response.json();
    debugLog('SavePickDraftResult:', result);
    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to save draft' };
    }
    return { success: true };
  } catch (error) {
    debugError('Error saving pick draft:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}
