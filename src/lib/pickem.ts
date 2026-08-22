// Pick'em Pool — the ONE authoritative service layer for Pick'em scoring,
// weekly winners, season totals, season winners, and tiebreaker resolution.
// Every UI surface and API route that needs Pick'em results (Picks page,
// Leaderboard, pool management, emails) must go through the exported
// functions here, never recompute scoring independently.
//
// This exists for the same reason src/lib/survivor.ts does: the Confidence
// Pool has at least four separate, historically-disagreeing implementations
// of "who won." Pick'em gets exactly one, mirroring Survivor's proven
// live-computation pattern (no cached/derived score table to fall out of
// sync — everything here is computed fresh from pickem_picks + games on
// every call).

import { getSupabaseServiceClient } from './supabase-service';
import { normalizeGameStatus } from '@/types/game';
import { showDebugPanel } from './utils';
import {
  parsePickemTypeSettings,
  isGameLocked,
  isWeekTooEarly,
  selectTiebreakerGame,
  type PickemTypeSettings,
} from './pickem-settings';

export type { PickemTypeSettings } from './pickem-settings';
export { DEFAULT_PICKEM_TYPE_SETTINGS, parsePickemTypeSettings, isGameLocked, isWeekTooEarly, selectTiebreakerGame } from './pickem-settings';

interface GameRow {
  id: string;
  week: number;
  season: number;
  season_type: number;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  status: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
}

interface PickemPickRow {
  id: string;
  participant_id: string;
  game_id: string;
  selected_team: string;
}

interface TiebreakerRow {
  participant_id: string;
  game_id: string;
  predicted_total: number;
}

export interface PickemGamePick {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  selectedTeam: string;
  /** 'pending' until the game has a final result. */
  result: 'correct' | 'incorrect' | 'pending';
}

export interface PickemParticipantWeek {
  participantId: string;
  participantName: string;
  picks: PickemGamePick[];
  correctCount: number;
  /** Every eligible game for this week has a pick from this participant. */
  isComplete: boolean;
  tiebreakerPrediction: number | null;
  /** Only set once the tiebreaker game itself is final. */
  tiebreakerDeviation: number | null;
}

export interface PickemTiebreakerGameInfo {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  /** Home + away score once the game is final, else null. */
  actualTotal: number | null;
}

export interface PickemWeekResult {
  poolId: string;
  season: number;
  seasonType: number;
  week: number;
  /** Every game a participant must pick this week — dynamically the actual
   * schedule for this (season, season_type, week), never a hardcoded count
   * (a preseason week can have as few as one game). */
  eligibleGames: Array<{ id: string; homeTeam: string; awayTeam: string; homeTeamId: string | null; awayTeamId: string | null; kickoffTime: string; status: string | null; homeScore: number | null; awayScore: number | null }>;
  /** True once every eligible game has a final result — winner/tiebreaker
   * resolution only applies once this is true. */
  isWeekFinal: boolean;
  tiebreakerGame: PickemTiebreakerGameInfo | null;
  participants: PickemParticipantWeek[];
  /** Empty until isWeekFinal; multiple entries means an unresolved tie
   * (tiebreaker disabled, unavailable, or itself tied) — never an
   * arbitrarily-chosen single winner. */
  winnerParticipantIds: string[];
}

export interface PickemSeasonParticipant {
  participantId: string;
  participantName: string;
  seasonCorrectCount: number;
  /** Sum of |predicted - actual| across every week both exist — the
   * season-level tiebreaker signal (see computePickemSeasonSummary's
   * header comment for why this exists). Null if no tiebreaker data. */
  tiebreakerTotalDeviation: number | null;
  weeklyResults: Array<{ week: number; seasonType: number; correctCount: number; eligibleGameCount: number; isWeekFinal: boolean }>;
}

export interface PickemSeasonSummary {
  poolId: string;
  season: number;
  seasonScope: number[];
  settings: PickemTypeSettings;
  participants: PickemSeasonParticipant[];
  currentWeek: { week: number; seasonType: number } | null;
  /** True once every week in season scope is fully final. */
  isSeasonComplete: boolean;
  /** Empty until isSeasonComplete; multiple entries means an unresolved tie. */
  seasonWinnerParticipantIds: string[];
}

function hasFinalResult(game: GameRow): boolean {
  return normalizeGameStatus(game.status) === 'finished' && game.home_score != null && game.away_score != null;
}

async function loadGamesForWeek(poolSeason: number, seasonType: number, week: number): Promise<GameRow[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('games')
    .select('id, week, season, season_type, home_team, away_team, kickoff_time, status, home_team_id, away_team_id, home_score, away_score')
    .eq('season', poolSeason)
    .eq('season_type', seasonType)
    .eq('week', week)
    .order('kickoff_time');
  if (error) throw new Error(error.message);
  return (data ?? []) as GameRow[];
}

async function loadPool(poolId: string) {
  const supabase = getSupabaseServiceClient();
  const { data: pool, error } = await supabase
    .from('pools')
    .select('id, season, season_scope, type_settings, competition_type, created_at')
    .eq('id', poolId)
    .single();
  if (error || !pool) throw new Error(error?.message ?? 'Pool not found');
  if (pool.competition_type !== 'PICKEM') {
    throw new Error(`Pick'em service called on a non-Pick'em pool (competition_type=${pool.competition_type})`);
  }
  return pool;
}

/** The one authoritative weekly-result computation. Always live. */
export async function computePickemWeekResult(poolId: string, week: number, seasonType: number, now: Date = new Date()): Promise<PickemWeekResult> {
  const pool = await loadPool(poolId);
  const settings = parsePickemTypeSettings(pool.type_settings);

  const games = await loadGamesForWeek(pool.season, seasonType, week);
  const isWeekFinal = games.length > 0 && games.every(hasFinalResult);

  const supabase = getSupabaseServiceClient();
  const { data: participants, error: participantsError } = await supabase
    .from('participants')
    .select('id, name')
    .eq('pool_id', poolId)
    .eq('is_active', true);
  if (participantsError) throw new Error(participantsError.message);

  const gameIds = games.map(g => g.id);
  const { data: picks, error: picksError } = gameIds.length > 0
    ? await supabase.from('pickem_picks').select('id, participant_id, game_id, selected_team').in('game_id', gameIds)
    : { data: [] as PickemPickRow[], error: null };
  if (picksError) throw new Error(picksError.message);

  const { data: tiebreakers, error: tiebreakersError } = await supabase
    .from('pickem_tiebreakers')
    .select('participant_id, game_id, predicted_total')
    .eq('pool_id', poolId)
    .eq('season', pool.season)
    .eq('season_type', seasonType)
    .eq('week', week);
  if (tiebreakersError) throw new Error(tiebreakersError.message);

  const tiebreakerGameRow = selectTiebreakerGame(games);
  const tiebreakerGame: PickemTiebreakerGameInfo | null = tiebreakerGameRow ? {
    gameId: tiebreakerGameRow.id,
    homeTeam: tiebreakerGameRow.home_team,
    awayTeam: tiebreakerGameRow.away_team,
    kickoffTime: tiebreakerGameRow.kickoff_time,
    actualTotal: hasFinalResult(tiebreakerGameRow) ? (tiebreakerGameRow.home_score! + tiebreakerGameRow.away_score!) : null,
  } : null;

  const picksByParticipant = new Map<string, PickemPickRow[]>();
  for (const p of (picks ?? []) as PickemPickRow[]) {
    if (!picksByParticipant.has(p.participant_id)) picksByParticipant.set(p.participant_id, []);
    picksByParticipant.get(p.participant_id)!.push(p);
  }
  const tiebreakerByParticipant = new Map((tiebreakers ?? []).map((t: TiebreakerRow) => [t.participant_id, t.predicted_total]));

  const participantWeeks: PickemParticipantWeek[] = (participants ?? []).map(participant => {
    const participantPicks = picksByParticipant.get(participant.id) ?? [];
    const pickByGame = new Map(participantPicks.map(p => [p.game_id, p]));

    const resolvedPicks: PickemGamePick[] = games.map(game => {
      const pick = pickByGame.get(game.id);
      if (!pick) {
        // No pick for this game — contributes 0, same as an incorrect pick,
        // but tracked separately so isComplete can distinguish it.
        return { gameId: game.id, homeTeam: game.home_team, awayTeam: game.away_team, selectedTeam: '', result: 'pending' as const };
      }
      if (!hasFinalResult(game)) {
        return { gameId: game.id, homeTeam: game.home_team, awayTeam: game.away_team, selectedTeam: pick.selected_team, result: 'pending' as const };
      }
      const pickedIsHome = pick.selected_team === game.home_team_id;
      const pickedScore = pickedIsHome ? game.home_score! : game.away_score!;
      const oppScore = pickedIsHome ? game.away_score! : game.home_score!;
      // A tied final score has no winner to have correctly picked.
      const result: 'correct' | 'incorrect' = pickedScore > oppScore ? 'correct' : 'incorrect';
      return { gameId: game.id, homeTeam: game.home_team, awayTeam: game.away_team, selectedTeam: pick.selected_team, result };
    });

    const correctCount = resolvedPicks.filter(p => p.result === 'correct').length;
    const isComplete = games.length > 0 && games.every(g => pickByGame.has(g.id));
    const tiebreakerPrediction = tiebreakerByParticipant.get(participant.id) ?? null;
    const tiebreakerDeviation = (tiebreakerPrediction != null && tiebreakerGame?.actualTotal != null)
      ? Math.abs(tiebreakerPrediction - tiebreakerGame.actualTotal)
      : null;

    return {
      participantId: participant.id,
      participantName: participant.name,
      picks: resolvedPicks,
      correctCount,
      isComplete,
      tiebreakerPrediction,
      tiebreakerDeviation,
    };
  });

  let winnerParticipantIds: string[] = [];
  if (isWeekFinal && participantWeeks.length > 0) {
    const maxCorrect = Math.max(...participantWeeks.map(p => p.correctCount));
    let tied = participantWeeks.filter(p => p.correctCount === maxCorrect);
    if (tied.length > 1 && settings.tiebreakerEnabled) {
      const withPredictions = tied.filter(p => p.tiebreakerDeviation != null);
      if (withPredictions.length > 0) {
        const minDeviation = Math.min(...withPredictions.map(p => p.tiebreakerDeviation!));
        tied = withPredictions.filter(p => p.tiebreakerDeviation === minDeviation);
      }
      // else: nobody in the tied group submitted a prediction — leave the
      // full tied group as co-winners rather than guessing.
    }
    winnerParticipantIds = tied.map(p => p.participantId);
  }

  return {
    poolId,
    season: pool.season,
    seasonType,
    week,
    eligibleGames: games.map(g => ({ id: g.id, homeTeam: g.home_team, awayTeam: g.away_team, homeTeamId: g.home_team_id, awayTeamId: g.away_team_id, kickoffTime: g.kickoff_time, status: g.status, homeScore: g.home_score, awayScore: g.away_score })),
    isWeekFinal,
    tiebreakerGame,
    participants: participantWeeks,
    winnerParticipantIds,
  };
}

/** The one authoritative season-summary computation — walks every week in
 * the pool's season_scope (same chronological-by-earliest-kickoff pattern
 * src/lib/survivor.ts uses), summing each participant's correct-pick count.
 * Season-level ties are broken by cumulative tiebreaker deviation (sum of
 * |predicted - actual| across every week both exist) — a deliberate,
 * explicit extension of the weekly "closest prediction wins" rule to the
 * season, not an invented arbitrary winner: it only ever resolves a tie
 * using prediction data participants already submitted, and a tie that
 * survives it is reported as co-winners rather than forced apart. */
export async function computePickemSeasonSummary(poolId: string, now: Date = new Date()): Promise<PickemSeasonSummary> {
  const pool = await loadPool(poolId);
  const settings = parsePickemTypeSettings(pool.type_settings);
  const seasonScope: number[] = pool.season_scope ?? [2];

  const supabase = getSupabaseServiceClient();
  const { data: allSeasonGames, error: allGamesError } = await supabase
    .from('games')
    .select('id, week, season, season_type, home_team, away_team, kickoff_time, status, home_team_id, away_team_id, home_score, away_score')
    .eq('season', pool.season)
    .in('season_type', seasonScope);
  if (allGamesError) throw new Error(allGamesError.message);

  const gamesByWeek = new Map<string, GameRow[]>();
  for (const g of (allSeasonGames ?? []) as GameRow[]) {
    const key = `${g.season_type}-${g.week}`;
    if (!gamesByWeek.has(key)) gamesByWeek.set(key, []);
    gamesByWeek.get(key)!.push(g);
  }
  const weekOrder = [...gamesByWeek.entries()]
    .map(([key, games]) => {
      const [seasonType, week] = key.split('-').map(Number);
      const earliestKickoff = Math.min(...games.map(g => new Date(g.kickoff_time).getTime()));
      return { seasonType, week, earliestKickoff };
    })
    .sort((a, b) => a.earliestKickoff - b.earliestKickoff);

  const { data: participants, error: participantsError } = await supabase
    .from('participants')
    .select('id, name')
    .eq('pool_id', poolId)
    .eq('is_active', true);
  if (participantsError) throw new Error(participantsError.message);

  const totals = new Map<string, { correct: number; deviationSum: number; deviationCount: number; weeklyResults: PickemSeasonParticipant['weeklyResults'] }>();
  for (const p of participants ?? []) {
    totals.set(p.id, { correct: 0, deviationSum: 0, deviationCount: 0, weeklyResults: [] });
  }

  for (const { seasonType, week } of weekOrder) {
    const weekResult = await computePickemWeekResult(poolId, week, seasonType, now);
    for (const pw of weekResult.participants) {
      const t = totals.get(pw.participantId);
      if (!t) continue;
      t.correct += pw.correctCount;
      if (pw.tiebreakerDeviation != null) {
        t.deviationSum += pw.tiebreakerDeviation;
        t.deviationCount += 1;
      }
      t.weeklyResults.push({ week, seasonType, correctCount: pw.correctCount, eligibleGameCount: weekResult.eligibleGames.length, isWeekFinal: weekResult.isWeekFinal });
    }
  }

  const seasonParticipants: PickemSeasonParticipant[] = (participants ?? []).map(p => {
    const t = totals.get(p.id)!;
    return {
      participantId: p.id,
      participantName: p.name,
      seasonCorrectCount: t.correct,
      tiebreakerTotalDeviation: t.deviationCount > 0 ? t.deviationSum : null,
      weeklyResults: t.weeklyResults,
    };
  });

  const isSeasonComplete = weekOrder.length > 0 && weekOrder.every(w => {
    const games = gamesByWeek.get(`${w.seasonType}-${w.week}`) ?? [];
    return games.length > 0 && games.every(hasFinalResult);
  });

  let seasonWinnerParticipantIds: string[] = [];
  if (isSeasonComplete && seasonParticipants.length > 0) {
    const maxCorrect = Math.max(...seasonParticipants.map(p => p.seasonCorrectCount));
    let tied = seasonParticipants.filter(p => p.seasonCorrectCount === maxCorrect);
    if (tied.length > 1 && settings.tiebreakerEnabled) {
      const withDeviation = tied.filter(p => p.tiebreakerTotalDeviation != null);
      if (withDeviation.length > 0) {
        const minDeviation = Math.min(...withDeviation.map(p => p.tiebreakerTotalDeviation!));
        tied = withDeviation.filter(p => p.tiebreakerTotalDeviation === minDeviation);
      }
    }
    seasonWinnerParticipantIds = tied.map(p => p.participantId);
  }

  const currentWeekEntry = weekOrder.find(w => {
    const games = gamesByWeek.get(`${w.seasonType}-${w.week}`) ?? [];
    return !games.every(hasFinalResult);
  }) ?? null;

  return {
    poolId,
    season: pool.season,
    seasonScope,
    settings,
    participants: seasonParticipants,
    currentWeek: currentWeekEntry ? { week: currentWeekEntry.week, seasonType: currentWeekEntry.seasonType } : null,
    isSeasonComplete,
    seasonWinnerParticipantIds,
  };
}

export type SubmitPickemPickResult =
  | { success: true }
  | { success: false; error: string };

/** Server-authoritative single-game pick submission — one game at a time
 * (not Confidence's atomic whole-week submit), so a participant can keep
 * picking/changing games that haven't started yet even after an earlier
 * game in the same week has already locked. Upserts (insert-or-replace) so
 * changing a not-yet-started game's pick is just calling this again. */
export async function submitPickemPick(params: {
  participantId: string;
  poolId: string;
  gameId: string;
  selectedTeam: string;
  submittedBy?: string;
  /** Dev-only: bypass the week-too-early / game-locked checks below, for
   * testing against a locked or finished game. Real gate is showDebugPanel()
   * (NODE_ENV + NEXT_PUBLIC_SHOW_DEBUG_PANEL), checked server-side here —
   * the caller passing true is not enough by itself, so this can never do
   * anything in production regardless of what a client sends. */
  devForceUnlock?: boolean;
}): Promise<SubmitPickemPickResult> {
  const supabase = getSupabaseServiceClient();

  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .select('id, season, competition_type')
    .eq('id', params.poolId)
    .single();
  if (poolError || !pool) return { success: false, error: 'Pool not found.' };
  if (pool.competition_type !== 'PICKEM') return { success: false, error: "This pool is not a Pick'em pool." };

  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select('id, pool_id, is_active')
    .eq('id', params.participantId)
    .single();
  if (participantError || !participant) return { success: false, error: 'Participant not found.' };
  if (participant.pool_id !== params.poolId) return { success: false, error: 'Participant does not belong to this pool.' };
  if (!participant.is_active) return { success: false, error: 'This participant is no longer active in this pool.' };

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id, week, season, season_type, kickoff_time, status, home_team_id, away_team_id')
    .eq('id', params.gameId)
    .single();
  if (gameError || !game) return { success: false, error: 'Game not found.' };
  if (game.home_team_id !== params.selectedTeam && game.away_team_id !== params.selectedTeam) {
    return { success: false, error: 'Selected team is not playing in this game.' };
  }

  // Week-level "too early" gate reuses DAYS_BEFORE_GAME (the same constant
  // Confidence/Survivor picks use) — see isWeekTooEarly's header comment for
  // why computeWeekUnlockStatus itself isn't called directly here.
  const { data: weekGames, error: weekGamesError } = await supabase
    .from('games')
    .select('id, kickoff_time, status')
    .eq('season', game.season)
    .eq('season_type', game.season_type)
    .eq('week', game.week);
  if (weekGamesError) return { success: false, error: 'Failed to verify week status.' };

  const now = new Date();
  const devUnlocked = showDebugPanel() && !!params.devForceUnlock;
  if (!devUnlocked && isWeekTooEarly(weekGames ?? [], now)) {
    return { success: false, error: 'This week is not open for picks yet.' };
  }
  if (!devUnlocked && isGameLocked(game, now)) {
    return { success: false, error: 'This game has already started — picks can no longer be submitted or changed for it.' };
  }

  const { error: upsertError } = await supabase
    .from('pickem_picks')
    .upsert({
      participant_id: params.participantId,
      pool_id: params.poolId,
      game_id: params.gameId,
      season: pool.season,
      season_type: game.season_type,
      week: game.week,
      selected_team: params.selectedTeam,
      submitted_by: params.submittedBy ?? null,
    }, { onConflict: 'participant_id,pool_id,game_id' });
  if (upsertError) {
    return { success: false, error: 'Failed to save pick. Please try again.' };
  }

  return { success: true };
}

export type SubmitPickemTiebreakerResult =
  | { success: true }
  | { success: false; error: string };

/** Server-authoritative tiebreaker-prediction submission — one row per
 * participant per week, upserted. Never counted as a game pick and never
 * adds/removes score points; it only feeds the tie-resolution above. */
export async function submitPickemTiebreaker(params: {
  participantId: string;
  poolId: string;
  week: number;
  seasonType: number;
  predictedTotal: number;
  submittedBy?: string;
}): Promise<SubmitPickemTiebreakerResult> {
  if (!Number.isFinite(params.predictedTotal) || params.predictedTotal < 0) {
    return { success: false, error: 'Enter a valid predicted total score.' };
  }

  const supabase = getSupabaseServiceClient();
  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .select('id, season, competition_type')
    .eq('id', params.poolId)
    .single();
  if (poolError || !pool) return { success: false, error: 'Pool not found.' };
  if (pool.competition_type !== 'PICKEM') return { success: false, error: "This pool is not a Pick'em pool." };

  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select('id, pool_id, is_active')
    .eq('id', params.participantId)
    .single();
  if (participantError || !participant) return { success: false, error: 'Participant not found.' };
  if (participant.pool_id !== params.poolId) return { success: false, error: 'Participant does not belong to this pool.' };
  if (!participant.is_active) return { success: false, error: 'This participant is no longer active in this pool.' };

  const games = await loadGamesForWeek(pool.season, params.seasonType, params.week);
  if (games.length === 0) return { success: false, error: 'No games found for this week.' };

  const now = new Date();
  if (isWeekTooEarly(games, now)) {
    return { success: false, error: 'This week is not open for picks yet.' };
  }
  const tiebreakerGame = selectTiebreakerGame(games);
  if (!tiebreakerGame) return { success: false, error: 'No tiebreaker game could be determined for this week.' };
  if (isGameLocked(tiebreakerGame, now)) {
    return { success: false, error: 'The tiebreaker game has already started — the prediction can no longer be submitted or changed.' };
  }

  const { error: upsertError } = await supabase
    .from('pickem_tiebreakers')
    .upsert({
      participant_id: params.participantId,
      pool_id: params.poolId,
      game_id: tiebreakerGame.id,
      season: pool.season,
      season_type: params.seasonType,
      week: params.week,
      predicted_total: Math.round(params.predictedTotal),
      submitted_by: params.submittedBy ?? null,
    }, { onConflict: 'participant_id,pool_id,season,season_type,week' });
  if (upsertError) {
    return { success: false, error: 'Failed to save tiebreaker prediction. Please try again.' };
  }

  return { success: true };
}
