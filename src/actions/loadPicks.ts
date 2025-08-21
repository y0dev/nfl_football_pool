import { Pick } from '@/types/game';

export interface LoadPicksOptions {
  poolId: string;
  participantId?: string;
  week?: number;
  seasonType?: number;
  includeGames?: boolean;
  includeParticipants?: boolean;
}

export interface LoadPicksResult {
  success: boolean;
  picks?: Pick[];
  error?: string;
  meta?: {
    poolId: string;
    participantId?: string;
    week?: number;
    seasonType?: number;
    total: number;
  };
}

export async function loadPicks(options: LoadPicksOptions): Promise<LoadPicksResult> {
  try {
    const { poolId, participantId, week, seasonType, includeGames, includeParticipants } = options;
    
    // Build query parameters
    const params = new URLSearchParams();
    params.append('poolId', poolId);
    
    if (participantId) {
      params.append('participantId', participantId);
    }
    
    if (week) {
      params.append('week', week.toString());
    }
    
    if (seasonType) {
      params.append('seasonType', seasonType.toString());
    }
    
    if (includeGames) {
      params.append('includeGames', 'true');
    }
    
    if (includeParticipants) {
      params.append('includeParticipants', 'true');
    }

    const response = await fetch(`/api/picks?${params.toString()}`);
    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to load picks'
      };
    }

    return {
      success: true,
      picks: result.picks,
      meta: result.meta
    };
  } catch (error) {
    console.error('Error loading picks:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Convenience functions for common use cases
export async function loadUserPicks(poolId: string, participantId: string, week?: number, seasonType?: number): Promise<LoadPicksResult> {
  return loadPicks({
    poolId,
    participantId,
    week,
    seasonType,
    includeGames: true
  });
}

export async function loadPoolPicks(poolId: string, week?: number, seasonType?: number): Promise<LoadPicksResult> {
  return loadPicks({
    poolId,
    week,
    seasonType,
    includeGames: true,
    includeParticipants: true
  });
}

export async function loadWeekPicks(poolId: string, week: number, seasonType: number): Promise<LoadPicksResult> {
  return loadPicks({
    poolId,
    week,
    seasonType,
    includeGames: true,
    includeParticipants: true
  });
}
