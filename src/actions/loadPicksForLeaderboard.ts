interface PickData {
  id: string;
  participant_id: string;
  participant_name: string;
  game_id: string;
  home_team: string;
  away_team: string;
  predicted_winner: string;
  confidence_points: number;
  week: number;
  season_type: number;
  // Add game result fields
  game_status?: string;
  game_winner?: string | null;
  home_score?: number | null;
  away_score?: number | null;
}

export interface LeaderboardEntryWithPicks {
  participant_id: string;
  participant_name: string;
  total_points: number;
  correct_picks: number;
  total_picks: number;
  game_points: { [gameId: string]: number };
  picks: PickData[];
}
