// Centralized Game interface and related types

export interface Game {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  game_status?: string;
  status: string;
  winner?: string | null;
  home_score?: number | null;
  away_score?: number | null;
  week?: number;
  season_type?: number;
  home_team_id?: number;
  away_team_id?: number;
  home_team_city?: string;
  away_team_city?: string;
  home_team_name?: string;
  away_team_name?: string;
}

export interface Pick {
  participant_id: string;
  pool_id: string;
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
  week?: number;
  season_type?: number;
  created_at?: string;
}

export interface StoredPick extends Pick {
  timestamp: number;
}

export interface GameResult {
  gameId: string;
  predictedWinner: string;
  actualWinner?: string;
  result: 'win' | 'loss' | 'pending';
  confidencePoints: number;
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  pool_id: string;
  is_active: boolean;
  picks?: Map<string, { predicted_winner: string; confidence_points: number }>;
}

export interface LeaderboardEntry {
  id: string;
  participant_id: string;
  pool_id: string;
  week: number;
  points: number;
  participants: {
    name: string;
  };
  game_points?: {
    [gameId: string]: number;
  };
}

export interface Pool {
  id: string;
  name: string;
  description?: string;
  require_access_code: boolean;
  access_code?: string;
  created_by: string;
  created_at: string;
  is_active: boolean;
  season: number;
  tie_breaker_method?: string;
  tie_breaker_question?: string;
  tie_breaker_answer?: number;
}

export interface SelectedUser {
  id: string;
  name: string;
  email?: string;
}
