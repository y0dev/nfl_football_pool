// Survivor Pool — the ONE authoritative service layer for Survivor status,
// eliminations, and winner determination. Every UI surface and API route
// that needs Survivor state (Picks page, Leaderboard, pool management,
// emails) must go through the exported functions here, never recompute
// status independently.
//
// This exists specifically to avoid repeating a known, explicitly-flagged
// architectural problem in this codebase: the Confidence Pool has at least
// four separate, historically-disagreeing implementations of "who won"
// (winner-calculator.ts [mostly dead], a Deno cron Edge Function, this
// file's live-computation sibling for Confidence — season-review.ts — and
// the leaderboard route's own inline computation). Survivor gets exactly
// one.
//
// Status (ACTIVE/ELIMINATED) is always computed LIVE from survivor_picks +
// games — there is no cached/derived status table to fall out of sync.
// WINNER is the one exception: it's only ever assigned by finalizeSurvivorSeason()
// (an explicit commissioner action, mirroring how season_winners works for
// Confidence pools — see src/app/api/admin/close-season/route.ts), never
// inferred just because someone happens to currently be the last participant
// standing. An active participant stays ACTIVE, not WINNER, until that
// explicit action runs.

import { getSupabaseServiceClient } from './supabase-service';
import { normalizeGameStatus } from '@/types/game';
import { computeWeekUnlockStatus } from './week-unlock-status';
import { debugError } from './utils';
import {
  parseSurvivorTypeSettings,
  type SurvivorTypeSettings,
} from './survivor-settings';

export type SurvivorStatus = 'ACTIVE' | 'ELIMINATED' | 'WINNER';
export type SurvivorEliminationReason = 'loss' | 'tie' | 'no_pick';

// Re-exported for existing callers of this file — the canonical
// definitions now live in survivor-settings.ts (a client-safe module with
// no server-only imports; see that file's header for why the split
// exists), since Pool Settings (a client component) needs the settings
// shape without pulling in this file's getSupabaseServiceClient import.
export type { SurvivorTypeSettings, SurvivorNoPickRule, SurvivorTieRule, SurvivorEndOfSeasonRule } from './survivor-settings';
export { DEFAULT_SURVIVOR_TYPE_SETTINGS, parseSurvivorTypeSettings } from './survivor-settings';

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

interface SurvivorPickRow {
  id: string;
  participant_id: string;
  pool_id: string;
  game_id: string;
  season: number;
  season_type: number;
  week: number;
  selected_team: string;
}

export interface SurvivorPickResult {
  week: number;
  seasonType: number;
  gameId: string;
  selectedTeam: string;
  /** 'pending' when the game has no final score yet — see hasFinalResult(). */
  result: 'win' | 'loss' | 'tie' | 'pending';
  /** Picked-team score minus opponent score. 0 for pending/tie. Used only
   * by the margin_tiebreaker end-of-season rule. */
  margin: number;
}

export interface SurvivorParticipantState {
  participantId: string;
  participantName: string;
  status: SurvivorStatus;
  usedTeams: string[];
  picks: SurvivorPickResult[];
  eliminatedWeek?: number;
  eliminatedSeasonType?: number;
  eliminatedTeam?: string;
  eliminatedGameId?: string;
  eliminatedReason?: SurvivorEliminationReason;
}

export interface SurvivorCurrentWeekGame {
  id: string;
  week: number;
  seasonType: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  kickoffTime: string;
  status: string | null;
}

export interface SurvivorPoolState {
  poolId: string;
  season: number;
  seasonScope: number[];
  settings: SurvivorTypeSettings;
  participants: SurvivorParticipantState[];
  activeCount: number;
  eliminatedCount: number;
  winnerParticipantIds: string[];
  /** The next (season_type, week) in the pool's season_scope that isn't
   * fully resolved yet — chronologically first among weeks where at least
   * one game still needs a final score. Null once every scheduled game in
   * scope has finished. The Picks page uses this to know what to show;
   * week-lock itself is still computed client-side via
   * computeWeekUnlockStatus (see currentWeekGames below). */
  currentWeek: { week: number; seasonType: number } | null;
  currentWeekGames: SurvivorCurrentWeekGame[];
}

function hasFinalResult(game: GameRow): boolean {
  return normalizeGameStatus(game.status) === 'finished' && game.home_score != null && game.away_score != null;
}

/** True once any game in the given week has started (kickoff passed, or a
 * non-'scheduled' status) — the same "has this week's window closed" signal
 * computeWeekUnlockStatus uses internally, factored out here since that
 * function's own false-cases don't distinguish "not open yet" from "already
 * closed," which the no-pick rule needs to tell apart. */
function hasWeekStarted(games: GameRow[], now: Date): boolean {
  return games.some(g => new Date(g.kickoff_time) <= now || (g.status != null && normalizeGameStatus(g.status) !== 'scheduled'));
}

/** The one authoritative status computation. Always live — no cached table
 * to read instead, so there is nothing that can drift out of sync with the
 * underlying picks/games data. */
export async function computeSurvivorPoolState(poolId: string, now: Date = new Date()): Promise<SurvivorPoolState> {
  const supabase = getSupabaseServiceClient();

  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .select('id, season, season_scope, type_settings, competition_type, created_at')
    .eq('id', poolId)
    .single();
  if (poolError || !pool) throw new Error(poolError?.message ?? 'Pool not found');
  if (pool.competition_type !== 'SURVIVOR') {
    throw new Error(`computeSurvivorPoolState called on a non-Survivor pool (competition_type=${pool.competition_type})`);
  }

  const settings = parseSurvivorTypeSettings(pool.type_settings);
  const seasonScope: number[] = pool.season_scope ?? [2];

  const { data: participants, error: participantsError } = await supabase
    .from('participants')
    .select('id, name')
    .eq('pool_id', poolId)
    .eq('is_active', true);
  if (participantsError) throw new Error(participantsError.message);

  const { data: picks, error: picksError } = await supabase
    .from('survivor_picks')
    .select('id, participant_id, pool_id, game_id, season, season_type, week, selected_team')
    .eq('pool_id', poolId)
    .eq('season', pool.season)
    .order('season_type', { ascending: true })
    .order('week', { ascending: true });
  if (picksError) throw new Error(picksError.message);

  const gameIds = [...new Set((picks ?? []).map(p => p.game_id))];
  const gamesById = new Map<string, GameRow>();
  if (gameIds.length > 0) {
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, week, season, season_type, home_team, away_team, kickoff_time, status, home_team_id, away_team_id, home_score, away_score')
      .in('id', gameIds);
    if (gamesError) throw new Error(gamesError.message);
    for (const g of games ?? []) gamesById.set(g.id, g as GameRow);
  }

  // For the no-pick rule: need every week in scope up through "now" to know
  // whether a missing pick means "hasn't happened yet" (fine) or "the
  // window closed and they never picked" (apply the rule). Pull every game
  // for the pool's season/season_scope once, grouped by week, rather than a
  // per-participant per-week query.
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
  // Every (season_type, week) combination that exists in the schedule,
  // sorted chronologically by its earliest kickoff — the walk order for
  // evaluating each participant's pick history.
  const weekOrder = [...gamesByWeek.entries()]
    .map(([key, games]) => {
      const [seasonType, week] = key.split('-').map(Number);
      const earliestKickoff = Math.min(...games.map(g => new Date(g.kickoff_time).getTime()));
      return { seasonType, week, games, earliestKickoff };
    })
    .sort((a, b) => a.earliestKickoff - b.earliestKickoff);

  const picksByParticipant = new Map<string, SurvivorPickRow[]>();
  for (const p of (picks ?? []) as SurvivorPickRow[]) {
    if (!picksByParticipant.has(p.participant_id)) picksByParticipant.set(p.participant_id, []);
    picksByParticipant.get(p.participant_id)!.push(p);
  }

  const participantStates: SurvivorParticipantState[] = (participants ?? []).map(participant => {
    const participantPicks = picksByParticipant.get(participant.id) ?? [];
    const pickByWeekKey = new Map(participantPicks.map(p => [`${p.season_type}-${p.week}`, p]));

    const resolvedPicks: SurvivorPickResult[] = [];
    const usedTeams: string[] = [];
    let status: SurvivorStatus = 'ACTIVE';
    let eliminatedWeek: number | undefined;
    let eliminatedSeasonType: number | undefined;
    let eliminatedTeam: string | undefined;
    let eliminatedGameId: string | undefined;
    let eliminatedReason: SurvivorEliminationReason | undefined;

    for (const { seasonType, week, games, earliestKickoff } of weekOrder) {
      if (status !== 'ACTIVE') break; // already eliminated — don't evaluate further weeks

      const pick = pickByWeekKey.get(`${seasonType}-${week}`);

      if (!pick) {
        // No pick for this week. Only a verdict once the week's window has
        // actually closed — an upcoming week with no pick yet is normal,
        // not a no-pick situation (Step 11: never evaluate early). Also
        // only for weeks whose FIRST game kicked off after the pool itself
        // was created — otherwise a pool created partway through a season
        // would retroactively eliminate every participant for "missing"
        // weeks that happened before the pool (and its picks) could exist.
        const weekPredatesPool = earliestKickoff < new Date(pool.created_at).getTime();
        if (hasWeekStarted(games, now) && !weekPredatesPool) {
          if (settings.noPickRule === 'eliminate') {
            status = 'ELIMINATED';
            eliminatedWeek = week;
            eliminatedSeasonType = seasonType;
            eliminatedTeam = undefined;
            eliminatedGameId = undefined;
            eliminatedReason = 'no_pick';
          }
          // else 'keep_active': skip this week entirely, move on
        }
        continue;
      }

      usedTeams.push(pick.selected_team);
      const game = gamesById.get(pick.game_id);
      if (!game || !hasFinalResult(game)) {
        // Game hasn't finished (or was postponed/cancelled and has no
        // score yet) — do not evaluate this pick yet. Participant stays
        // ACTIVE; this pick is 'pending'.
        resolvedPicks.push({ week, seasonType, gameId: pick.game_id, selectedTeam: pick.selected_team, result: 'pending', margin: 0 });
        continue;
      }

      const pickedIsHome = pick.selected_team === game.home_team_id;
      const pickedScore = pickedIsHome ? game.home_score! : game.away_score!;
      const oppScore = pickedIsHome ? game.away_score! : game.home_score!;
      const margin = pickedScore - oppScore;

      if (pickedScore > oppScore) {
        resolvedPicks.push({ week, seasonType, gameId: pick.game_id, selectedTeam: pick.selected_team, result: 'win', margin });
        continue; // survives, evaluate next week
      }

      if (pickedScore === oppScore) {
        resolvedPicks.push({ week, seasonType, gameId: pick.game_id, selectedTeam: pick.selected_team, result: 'tie', margin: 0 });
        if (settings.tieRule === 'eliminate') {
          status = 'ELIMINATED';
          eliminatedWeek = week;
          eliminatedSeasonType = seasonType;
          eliminatedTeam = pick.selected_team;
          eliminatedGameId = pick.game_id;
          eliminatedReason = 'tie';
        }
        continue;
      }

      // Loss.
      resolvedPicks.push({ week, seasonType, gameId: pick.game_id, selectedTeam: pick.selected_team, result: 'loss', margin });
      status = 'ELIMINATED';
      eliminatedWeek = week;
      eliminatedSeasonType = seasonType;
      eliminatedTeam = pick.selected_team;
      eliminatedGameId = pick.game_id;
      eliminatedReason = 'loss';
    }

    return {
      participantId: participant.id,
      participantName: participant.name,
      status,
      usedTeams,
      picks: resolvedPicks,
      eliminatedWeek,
      eliminatedSeasonType,
      eliminatedTeam,
      eliminatedGameId,
      eliminatedReason,
    };
  });

  // Layer WINNER on top of the live ACTIVE/ELIMINATED computation, but only
  // for participants named in a persisted survivor_winners row — never
  // inferred just from currently being the last one active.
  const { data: winnerRow } = await supabase
    .from('survivor_winners')
    .select('winner_participant_ids')
    .eq('pool_id', poolId)
    .eq('season', pool.season)
    .maybeSingle();
  const winnerParticipantIds: string[] = winnerRow?.winner_participant_ids ?? [];
  if (winnerParticipantIds.length > 0) {
    for (const p of participantStates) {
      if (winnerParticipantIds.includes(p.participantId)) p.status = 'WINNER';
    }
  }

  const currentWeekEntry = weekOrder.find(w => !w.games.every(hasFinalResult)) ?? null;
  const currentWeek = currentWeekEntry ? { week: currentWeekEntry.week, seasonType: currentWeekEntry.seasonType } : null;
  const currentWeekGames: SurvivorCurrentWeekGame[] = (currentWeekEntry?.games ?? []).map(g => ({
    id: g.id,
    week: g.week,
    seasonType: g.season_type,
    homeTeam: g.home_team,
    awayTeam: g.away_team,
    homeTeamId: g.home_team_id,
    awayTeamId: g.away_team_id,
    kickoffTime: g.kickoff_time,
    status: g.status,
  }));

  return {
    poolId,
    season: pool.season,
    seasonScope,
    settings,
    participants: participantStates,
    activeCount: participantStates.filter(p => p.status === 'ACTIVE').length,
    eliminatedCount: participantStates.filter(p => p.status === 'ELIMINATED').length,
    winnerParticipantIds,
    currentWeek,
    currentWeekGames,
  };
}

export type SubmitSurvivorPickResult =
  | { success: true }
  | { success: false; error: string };

/** Server-authoritative pick submission — validates everything the client
 * already checks (not eliminated, team not previously used, week still
 * unlocked) again here, since the client check is UX only. Supports
 * changing an already-made pick for the CURRENT week as long as it's still
 * unlocked (delete-then-insert, so the reuse check below naturally excludes
 * the pick being replaced). */
export async function submitSurvivorPick(params: {
  participantId: string;
  poolId: string;
  gameId: string;
  selectedTeam: string;
  submittedBy?: string;
}): Promise<SubmitSurvivorPickResult> {
  const supabase = getSupabaseServiceClient();

  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .select('id, season, competition_type')
    .eq('id', params.poolId)
    .single();
  if (poolError || !pool) return { success: false, error: 'Pool not found.' };
  if (pool.competition_type !== 'SURVIVOR') return { success: false, error: 'This pool is not a Survivor pool.' };

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

  // Status check: cannot pick once eliminated (or once a winner has been
  // determined and the pool is closed).
  const state = await computeSurvivorPoolState(params.poolId);
  const participantState = state.participants.find(p => p.participantId === params.participantId);
  if (participantState && participantState.status !== 'ACTIVE') {
    return { success: false, error: `You are ${participantState.status === 'WINNER' ? 'the winner of' : 'eliminated from'} this Survivor pool and cannot make further picks.` };
  }

  // Week-lock check — reuses the exact same rule Confidence Pool picks use
  // (src/lib/week-unlock-status.ts), per the explicit decision not to
  // introduce Survivor-specific unlock behavior.
  const { data: weekGames, error: weekGamesError } = await supabase
    .from('games')
    .select('id, kickoff_time, status')
    .eq('season', game.season)
    .eq('season_type', game.season_type)
    .eq('week', game.week);
  if (weekGamesError) return { success: false, error: 'Failed to verify week status.' };
  const unlocked = computeWeekUnlockStatus(weekGames ?? [], game.week, game.season_type, null);
  if (!unlocked) {
    return { success: false, error: 'This week is locked — picks can no longer be submitted or changed.' };
  }

  // Delete any existing pick for this participant/week (supports changing
  // an unlocked week's pick), then re-check team reuse against what
  // remains, then insert.
  const { error: deleteError } = await supabase
    .from('survivor_picks')
    .delete()
    .eq('participant_id', params.participantId)
    .eq('pool_id', params.poolId)
    .eq('season', pool.season)
    .eq('season_type', game.season_type)
    .eq('week', game.week);
  if (deleteError) return { success: false, error: 'Failed to update pick.' };

  const { data: existingPicks, error: existingPicksError } = await supabase
    .from('survivor_picks')
    .select('selected_team')
    .eq('participant_id', params.participantId)
    .eq('pool_id', params.poolId)
    .eq('season', pool.season);
  if (existingPicksError) return { success: false, error: 'Failed to verify previously used teams.' };
  if ((existingPicks ?? []).some(p => p.selected_team === params.selectedTeam)) {
    return { success: false, error: 'You have already used this team this season. You can only use each team once during the pool.' };
  }

  const { error: insertError } = await supabase
    .from('survivor_picks')
    .insert({
      participant_id: params.participantId,
      pool_id: params.poolId,
      game_id: params.gameId,
      season: pool.season,
      season_type: game.season_type,
      week: game.week,
      selected_team: params.selectedTeam,
      submitted_by: params.submittedBy ?? null,
    });
  if (insertError) {
    debugError('submitSurvivorPick insert error:', insertError);
    // The UNIQUE constraints are the authoritative backstop even if the
    // pre-checks above raced with a concurrent submission.
    if (insertError.code === '23505') {
      return { success: false, error: 'That team has already been used, or a pick already exists for this week.' };
    }
    return { success: false, error: 'Failed to save pick. Please try again.' };
  }

  return { success: true };
}

export interface FinalizeSurvivorSeasonResult {
  success: true;
  winnerParticipantIds: string[];
  resolution: string;
}

/** Explicit, commissioner-triggered season-end resolution — the only place
 * a Survivor pool's WINNER status is ever assigned. Always recomputes and
 * upserts (never trusts a previously-stored row), mirroring how Confidence
 * Pool's close-season action always recomputes season_winners rather than
 * reading a cached value. */
export async function finalizeSurvivorSeason(poolId: string): Promise<FinalizeSurvivorSeasonResult | { success: false; error: string }> {
  const supabase = getSupabaseServiceClient();
  const state = await computeSurvivorPoolState(poolId);

  let winnerParticipantIds: string[];
  let resolution: string;

  // Includes WINNER, not just ACTIVE: a participant already declared the
  // winner by a previous finalize call was never eliminated, so re-running
  // finalize (e.g. after a score correction) must still count them as a
  // surviving candidate — otherwise a second call sees zero ACTIVE
  // participants (they're all WINNER already) and zero ELIMINATED ones,
  // and incorrectly falls through to the "no participants" error below.
  const active = state.participants.filter(p => p.status === 'ACTIVE' || p.status === 'WINNER');

  if (active.length === 1) {
    winnerParticipantIds = [active[0].participantId];
    resolution = 'last_active';
  } else if (active.length > 1) {
    if (state.settings.endOfSeasonRule === 'all_remaining_winners') {
      winnerParticipantIds = active.map(p => p.participantId);
      resolution = 'all_remaining';
    } else {
      const result = pickByMarginTiebreaker(active);
      winnerParticipantIds = result;
      resolution = 'margin_tiebreaker';
    }
  } else {
    // Wipeout — every participant was eliminated. The "last remaining"
    // group is whoever survived the longest (the highest eliminatedWeek),
    // evaluated with the same end-of-season rule as a normal multi-survivor
    // finish, since they were functionally tied for last-standing.
    const eliminated = state.participants.filter(p => p.status === 'ELIMINATED');
    if (eliminated.length === 0) {
      return { success: false, error: 'No participants found for this pool — nothing to finalize.' };
    }
    const maxWeek = Math.max(...eliminated.map(p => p.eliminatedWeek ?? -1));
    const lastStanding = eliminated.filter(p => p.eliminatedWeek === maxWeek);
    if (lastStanding.length === 1) {
      winnerParticipantIds = [lastStanding[0].participantId];
      resolution = 'wipeout_last_standing';
    } else if (state.settings.endOfSeasonRule === 'all_remaining_winners') {
      winnerParticipantIds = lastStanding.map(p => p.participantId);
      resolution = 'wipeout_all_remaining';
    } else {
      winnerParticipantIds = pickByMarginTiebreaker(lastStanding);
      resolution = 'wipeout_margin_tiebreaker';
    }
  }

  const { error } = await supabase
    .from('survivor_winners')
    .upsert({
      pool_id: poolId,
      season: state.season,
      winner_participant_ids: winnerParticipantIds,
      resolution,
    }, { onConflict: 'pool_id,season' });
  if (error) return { success: false, error: error.message };

  return { success: true, winnerParticipantIds, resolution };
}

function pickByMarginTiebreaker(candidates: SurvivorParticipantState[]): string[] {
  const totals = candidates.map(p => ({
    id: p.participantId,
    margin: p.picks.reduce((sum, pick) => sum + (pick.result === 'win' ? pick.margin : 0), 0),
  }));
  const maxMargin = Math.max(...totals.map(t => t.margin));
  return totals.filter(t => t.margin === maxMargin).map(t => t.id);
}
