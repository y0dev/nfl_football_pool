export interface WeeklyWinner {
  id: string;
  pool_id: string;
  week: number;
  season: number;
  winner_participant_id: string | null;
  winner_name: string;
  winner_points: number;
  winner_correct_picks: number;
  tie_breaker_used: boolean;
  tie_breaker_question: string | null;
  tie_breaker_answer: number | null;
  winner_tie_breaker_answer: number | null;
  tie_breaker_difference: number | null;
  total_participants: number;
  created_at: string;
  updated_at: string;
  pools: {
    name: string;
  };
}

export interface SeasonWinner {
  id: string;
  pool_id: string;
  season: number;
  winner_participant_id: string | null;
  winner_name: string;
  total_points: number;
  total_correct_picks: number;
  weeks_won: number;
  tie_breaker_used: boolean;
  tie_breaker_question: string | null;
  tie_breaker_answer: number | null;
  winner_tie_breaker_answer: number | null;
  tie_breaker_difference: number | null;
  total_participants: number;
  created_at: string;
  updated_at: string;
  pools: {
    name: string;
  };
}

export interface PeriodWinner {
  id: string;
  pool_id: string;
  season: number;
  period_name: string;
  start_week: number;
  end_week: number;
  winner_participant_id: string | null;
  winner_name: string;
  period_points: number;
  period_correct_picks: number;
  weeks_won: number;
  tie_breaker_used: boolean;
  tie_breaker_question: string | null;
  tie_breaker_answer: number | null;
  winner_tie_breaker_answer: number | null;
  tie_breaker_difference: number | null;
  total_participants: number;
  created_at: string;
  updated_at: string;
  pools: {
    name: string;
  };
}

export interface WinnerStats {
  totalWeeks: number;
  totalParticipants: number;
  averagePointsPerWeek: number;
  highestWeeklyScore: number;
  lowestWeeklyScore: number;
  tieBreakersUsed: number;
  mostWinsByParticipant: string;
  mostWinsCount: number;
}
