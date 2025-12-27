import { getSupabaseServiceClient } from './supabase';

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
      console.error('Error fetching playoff confidence points:', error);
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
    console.error('Error in getPlayoffConfidencePoints:', error);
    return null;
  }
}

/**
 * Get confidence points for a predicted winner in a playoff game
 * Returns the confidence points assigned to that team, or null if not found
 */
export async function getPlayoffConfidencePointsForTeam(
  poolId: string,
  season: number,
  participantId: string,
  teamName: string
): Promise<number | null> {
  const pointsMap = await getPlayoffConfidencePoints(poolId, season, participantId);
  if (!pointsMap) {
    return null;
  }
  return pointsMap[teamName] || null;
}

/**
 * Check if a pool/season has playoff confidence points configured
 */
export async function hasPlayoffConfidencePoints(
  poolId: string,
  season: number
): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('playoff_confidence_points')
      .select('id')
      .eq('pool_id', poolId)
      .eq('season', season)
      .limit(1);

    if (error) {
      console.error('Error checking playoff confidence points:', error);
      return false;
    }

    return (data?.length || 0) > 0;
  } catch (error) {
    console.error('Error in hasPlayoffConfidencePoints:', error);
    return false;
  }
}

/**
 * Check if a game is a playoff game
 */
export function isPlayoffGame(seasonType: number): boolean {
  return seasonType === 3; // 3 = Postseason/Playoffs
}

