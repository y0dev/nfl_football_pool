export interface PoolPicksStatus {
  hasPicks: boolean;
  submittedCount: number;
}

export interface Pool {
  id: string;
  name: string;
  season: number;
  season_scope: number[];
  is_active: boolean;
  created_at: string;
  tie_breaker_method: string;
  tie_breaker_question: string | null;
  tie_breaker_answer: number | null;
  participant_count: number;
  is_test_mode: boolean;
  picks_status: PoolPicksStatus | null;
}

export interface LeaderboardEntry {
  participant_id: string;
  participant_name: string;
  total_points: number;
  correct_picks: number;
}

export interface LeaderboardResult {
  success: boolean;
  leaderboard: LeaderboardEntry[];
  totalParticipants: number;
}

export interface WeekWinner {
  winner_name: string;
  winner_points: number;
  winner_correct_picks: number;
}

export interface WeekWinnerResult {
  winnerExists: boolean;
  winner: WeekWinner | null;
}

export interface TeamRecord {
  team_id: string;
  team_abbreviation: string;
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

export interface SaveWeekWinnerParams {
  poolId: string;
  week: number;
  season: number;
  seasonType: number;
  winnerParticipantId: string;
  winnerName: string;
  winnerPoints: number;
  winnerCorrectPicks: number;
  totalParticipants: number;
}

class PoolsAPIService {
  private async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) {
      const error = new Error(`Pools API ${path} failed: ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }
    return response.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = new Error(`Pools API POST ${path} failed: ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }
    return response.json() as Promise<T>;
  }

  async getPool(poolId: string, week?: number, seasonType?: number, signal?: AbortSignal): Promise<{ success: boolean; pool: Pool }> {
    const params = new URLSearchParams();
    if (week !== undefined) params.set('week', String(week));
    if (seasonType !== undefined) params.set('seasonType', String(seasonType));
    const query = params.size ? `?${params}` : '';
    return this.get(`/api/pools/${poolId}${query}`, signal);
  }

  async getPoolSeasonScope(poolId: string): Promise<{ success: boolean; season_scope: number[] }> {
    return this.get(`/api/pools/${poolId}/season-scope`);
  }

  async checkPlayoffConfidence(poolId: string, season: number): Promise<{ success: boolean; allSubmitted: boolean }> {
    return this.get(`/api/playoffs/${poolId}/confidence-points?season=${season}`);
  }

  async getWeekWinner(poolId: string, week: number, seasonType: number, season: number): Promise<WeekWinnerResult> {
    return this.get(`/api/admin/week-winner?poolId=${poolId}&week=${week}&seasonType=${seasonType}&season=${season}`);
  }

  async saveWeekWinner(params: SaveWeekWinnerParams): Promise<{ success: boolean }> {
    return this.post('/api/admin/week-winner', params);
  }

  async getLeaderboard(poolId: string, week: number, seasonType: number, season: number): Promise<LeaderboardResult> {
    return this.get(`/api/leaderboard?poolId=${poolId}&week=${week}&seasonType=${seasonType}&season=${season}`);
  }

  async getTeamRecords(season: number): Promise<{ success: boolean; records: TeamRecord[] }> {
    return this.get(`/api/team-records?season=${season}`);
  }
}

export const poolsAPI = new PoolsAPIService();
