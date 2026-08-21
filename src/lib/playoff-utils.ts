'use server';

import { getSupabaseServiceClient } from './supabase-service';
import { debugError } from '@/lib/utils';

/**
 * Get playoff confidence points for a participant
 * Returns a map of team_name -> confidence_points
 */
export async function getPlayoffConfidencePoints(
  poolId: string,
  season: number,
  participantId: string
): Promise<Record<string, number> | null> {
  try {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('playoff_confidence_points')
      .select('team_name, confidence_points')
      .eq('pool_id', poolId)
      .eq('season', season)
      .eq('participant_id', participantId);

    if (error) {
      debugError('Error fetching playoff confidence points:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const pointsMap: Record<string, number> = {};
    data.forEach(item => {
      pointsMap[item.team_name] = item.confidence_points;
    });

    return pointsMap;
  } catch (error) {
    debugError('Error in getPlayoffConfidencePoints:', error);
    return null;
  }
}

