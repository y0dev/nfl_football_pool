import { Pick } from '@/types/game';

interface SubmitPicksResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function submitPicks(picks: Pick[]): Promise<SubmitPicksResult> {
  try {
    // Validate picks
    if (picks.length === 0) {
      return {
        success: false,
        error: 'No picks provided'
      };
    }

    // Validate that all picks have a valid participant_id
    const firstPick = picks[0];
    if (!firstPick.participant_id || firstPick.participant_id.trim() === '') {
      return {
        success: false, error: 'Invalid participant ID. Please select a user first.'
      };
    }

    // Submit picks through the API endpoint
    const response = await fetch('/api/picks/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(picks),
    });

    const result = await response.json();
    console.log('SubmitPicksResult:', result);
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to submit picks'
      };
    }

    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('Error submitting picks:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
