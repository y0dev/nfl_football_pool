// Centralized Game interface and related types

export interface TeamRecord {
  wins: number;
  losses: number;
  ties: number;
  home_wins?: number;
  home_losses?: number;
  home_ties?: number;
  road_wins?: number;
  road_losses?: number;
  road_ties?: number;
}

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
  home_team_record?: TeamRecord;
  away_team_record?: TeamRecord;
}

export type NormalizedGameStatus = 'scheduled' | 'live' | 'finished';

// games.status is written as 'scheduled' | 'live' | 'finished' by the
// current sync path (supabase/functions/update-game-scores/index.ts,
// src/lib/nfl-api.ts), but older/other write paths left real rows with
// 'Scheduled', 'final', 'Final', etc. still in the DB (confirmed: 219 rows
// as of this audit are 'Final', not 'finished') — status display must not
// do a strict/case-sensitive match against a single spelling, or it
// silently mis-displays a real portion of games as still-scheduled instead
// of final. This does not change what gets written, only how the existing
// value space is interpreted for display.
export function normalizeGameStatus(status: string | null | undefined): NormalizedGameStatus {
  const s = status?.toLowerCase();
  if (s === 'finished' || s === 'final' || s === 'post') return 'finished';
  if (s === 'live' || s === 'in_progress' || s === 'in') return 'live';
  return 'scheduled';
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
  monday_night_score?: number;
}

export interface StoredPick extends Pick {
  timestamp: number;
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

export interface SelectedUser {
  id: string;
  name: string;
  email?: string;
}
