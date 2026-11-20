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
// Two separate things per participant:
//   - liveStatus (ACTIVE/ELIMINATED): eligibility, always computed LIVE from
//     survivor_picks + games. Nothing cached, so a corrected game result
//     changes it immediately.
//   - status: what to show. Same as liveStatus, except participants named in
//     the persisted survivor_winners row show as WINNER. That row is only
//     written by finalizeSurvivorSeason() (an explicit commissioner action),
//     never inferred from someone currently being the last one standing.
// Finalization decides winners from liveStatus only, never from the
// persisted WINNER label. Otherwise a winner whose winning game was later
// corrected to a loss would keep counting as a survivor and stay the winner
// on every re-finalization.

import { getSupabaseServiceClient } from './supabase-service';
import { normalizeGameStatus } from '@/types/game';
import { computeWeekUnlockStatus } from './week-unlock-status';
import { debugError, showDebugPanel } from './utils';
import {
  parseSurvivorTypeSettings,
  type SurvivorTypeSettings,
} from './survivor-settings';

export type SurvivorStatus = 'ACTIVE' | 'ELIMINATED' | 'WINNER';
export type SurvivorLiveStatus = 'ACTIVE' | 'ELIMINATED';
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
  /** Human-readable team name (games.home_team / away_team text column),
   * resolved from selectedTeam (a VARCHAR games.home_team_id/away_team_id
   * value, not a display name) — so callers never need their own team-id
   * lookup just to show what a participant actually picked. Falls back to
   * the raw id in the unexpected case the pick's game can't be found. */
  selectedTeamName: string;
  /** 'pending' when the game has no final score yet — see hasFinalResult(). */
  result: 'win' | 'loss' | 'tie' | 'pending';
  /** Picked-team score minus opponent score. 0 for pending/tie. Used only
   * by the margin_tiebreaker end-of-season rule. */
  margin: number;
}

export interface SurvivorParticipantState {
  participantId: string;
  participantName: string;
  /** Display status: liveStatus, or WINNER for participants in the
   * persisted survivor_winners row. Don't use it to decide eligibility. */
  status: SurvivorStatus;
  /** Eligibility from current game results only. Ignores survivor_winners. */
  liveStatus: SurvivorLiveStatus;
  usedTeams: string[];
  picks: SurvivorPickResult[];
  eliminatedWeek?: number;
  eliminatedSeasonType?: number;
  eliminatedTeam?: string;
  /** Human-readable name for eliminatedTeam — see SurvivorPickResult.selectedTeamName. */
  eliminatedTeamName?: string;
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
  homeScore: number | null;
  awayScore: number | null;
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
  finalization: SurvivorFinalization;
}

/** Whether the persisted survivor_winners row still matches what current
 * game results say. A corrected result after finalizing makes it
 * 'outdated' — the commissioner must re-finalize; nothing does it for them
 * (see finalizeSurvivorSeason). */
export interface SurvivorFinalization {
  status: 'not_finalized' | 'up_to_date' | 'outdated';
  finalizedAt: string | null;
  /** Winners as stored at the last finalization. */
  finalizedWinnerIds: string[];
  /** Winners re-finalizing now would store (null if none can be resolved). */
  currentWinnerIds: string[] | null;
  /** True only when no unresolved game can still change who wins: the
   * schedule isn't empty, and either every game in scope is final or at most
   * one player is alive and no pending pick could reorder the eliminations.
   * Enforced by finalizeSurvivorSeason(), including re-finalization. */
  readyToFinalize: boolean;
  /** Why the season can't be finalized yet (null when ready). */
  notReadyReason: string | null;
}

/** What the schedule looks like for the pool's season scope. */
export interface SurvivorScheduleSummary {
  gameCount: number;
  allGamesFinal: boolean;
}

export function describeSurvivorFinalization(
  participants: WinnerCandidate[],
  settings: Pick<SurvivorTypeSettings, 'endOfSeasonRule'>,
  stored: { winnerParticipantIds: string[]; determinedAt: string | null } | null,
  schedule: SurvivorScheduleSummary,
): SurvivorFinalization {
  const resolved = resolveSurvivorWinners(participants, settings);
  const currentWinnerIds = resolved.success ? [...resolved.winnerParticipantIds].sort() : null;
  const finalizedWinnerIds = [...(stored?.winnerParticipantIds ?? [])].sort();
  const notReadyReason = survivorNotReadyReason(participants, schedule);
  const finalized = !!stored && finalizedWinnerIds.length > 0;
  const matches = currentWinnerIds != null
    && currentWinnerIds.length === finalizedWinnerIds.length
    && currentWinnerIds.every((id, i) => id === finalizedWinnerIds[i]);
  return {
    status: !finalized ? 'not_finalized' : matches ? 'up_to_date' : 'outdated',
    finalizedAt: stored?.determinedAt ?? null,
    finalizedWinnerIds,
    currentWinnerIds,
    readyToFinalize: notReadyReason === null,
    notReadyReason,
  };
}

/** Week position in the same ordering eliminationOrder() uses. */
function weekOrderOf(seasonType: number, week: number): number {
  return seasonType * 100 + week;
}

/** Null when the winner no longer depends on any unresolved game. */
function survivorNotReadyReason(participants: WinnerCandidate[], schedule: SurvivorScheduleSummary): string | null {
  if (participants.length === 0) return 'This pool has no active participants.';
  if (schedule.gameCount === 0) return "No games are scheduled in this pool's season scope yet.";

  const active = participants.filter(p => p.liveStatus === 'ACTIVE');
  if (active.length > 1 && !schedule.allGamesFinal) {
    return 'More than one player is still alive and games remain to be played.';
  }

  // A pick on an unfinished game can still change when (or whether) its
  // player was eliminated, which changes the winner. With one player left,
  // only picks up to the latest elimination matter: that player's later
  // picks can't let anyone else outlast them. Otherwise (a wipeout, or
  // several survivors decided by the end-of-season rule) every pending pick
  // matters.
  const eliminated = participants.filter(p => p.liveStatus === 'ELIMINATED');
  const cutoff = active.length === 1
    ? (eliminated.length > 0 ? Math.max(...eliminated.map(eliminationOrder)) : -Infinity)
    : Infinity;
  const unresolved = participants.some(p =>
    p.picks.some(pick => pick.result === 'pending' && weekOrderOf(pick.seasonType, pick.week) <= cutoff));
  if (unresolved) return "A pick on a game that isn't final yet could still change the winner.";

  return null;
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
    let status: SurvivorLiveStatus = 'ACTIVE';
    let eliminatedWeek: number | undefined;
    let eliminatedSeasonType: number | undefined;
    let eliminatedTeam: string | undefined;
    let eliminatedTeamName: string | undefined;
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
      // games.home_team_id/away_team_id are opaque ids (VARCHAR, not a
      // display name) — resolve to the game's own home_team/away_team text
      // columns so every consumer of SurvivorPickResult gets a real team
      // name for free, never a raw id to display or re-resolve itself.
      const selectedTeamName = game
        ? (pick.selected_team === game.home_team_id ? game.home_team : pick.selected_team === game.away_team_id ? game.away_team : pick.selected_team)
        : pick.selected_team;
      if (!game || !hasFinalResult(game)) {
        // Game hasn't finished (or was postponed/cancelled and has no
        // score yet) — do not evaluate this pick yet. Participant stays
        // ACTIVE; this pick is 'pending'.
        resolvedPicks.push({ week, seasonType, gameId: pick.game_id, selectedTeam: pick.selected_team, selectedTeamName, result: 'pending', margin: 0 });
        continue;
      }

      const pickedIsHome = pick.selected_team === game.home_team_id;
      const pickedScore = pickedIsHome ? game.home_score! : game.away_score!;
      const oppScore = pickedIsHome ? game.away_score! : game.home_score!;
      const margin = pickedScore - oppScore;

      if (pickedScore > oppScore) {
        resolvedPicks.push({ week, seasonType, gameId: pick.game_id, selectedTeam: pick.selected_team, selectedTeamName, result: 'win', margin });
        continue; // survives, evaluate next week
      }

      if (pickedScore === oppScore) {
        resolvedPicks.push({ week, seasonType, gameId: pick.game_id, selectedTeam: pick.selected_team, selectedTeamName, result: 'tie', margin: 0 });
        if (settings.tieRule === 'eliminate') {
          status = 'ELIMINATED';
          eliminatedWeek = week;
          eliminatedSeasonType = seasonType;
          eliminatedTeam = pick.selected_team;
          eliminatedTeamName = selectedTeamName;
          eliminatedGameId = pick.game_id;
          eliminatedReason = 'tie';
        }
        continue;
      }

      // Loss.
      resolvedPicks.push({ week, seasonType, gameId: pick.game_id, selectedTeam: pick.selected_team, selectedTeamName, result: 'loss', margin });
      status = 'ELIMINATED';
      eliminatedWeek = week;
      eliminatedSeasonType = seasonType;
      eliminatedTeam = pick.selected_team;
      eliminatedTeamName = selectedTeamName;
      eliminatedGameId = pick.game_id;
      eliminatedReason = 'loss';
    }

    return {
      participantId: participant.id,
      participantName: participant.name,
      status: status as SurvivorStatus,
      liveStatus: status,
      usedTeams,
      picks: resolvedPicks,
      eliminatedWeek,
      eliminatedSeasonType,
      eliminatedTeam,
      eliminatedTeamName,
      eliminatedGameId,
      eliminatedReason,
    };
  });

  // Layer WINNER on top of the live ACTIVE/ELIMINATED computation for
  // display, but only for participants named in a persisted survivor_winners
  // row — never inferred just from currently being the last one active.
  // liveStatus is left alone.
  const { data: winnerRow, error: winnerError } = await supabase
    .from('survivor_winners')
    .select('winner_participant_ids, determined_at')
    .eq('pool_id', poolId)
    .eq('season', pool.season)
    .maybeSingle();
  if (winnerError) throw new Error(winnerError.message);
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
    homeScore: g.home_score,
    awayScore: g.away_score,
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
    finalization: describeSurvivorFinalization(
      participantStates,
      settings,
      winnerRow ? { winnerParticipantIds, determinedAt: winnerRow.determined_at ?? null } : null,
      { gameCount: allSeasonGames?.length ?? 0, allGamesFinal: currentWeekEntry === null },
    ),
  };
}

const TEAM_ALREADY_USED_ERROR = 'You have already used this team this season. You can only use each team once during the pool.';

export type SubmitSurvivorPickResult =
  | { success: true }
  | { success: false; error: string };

/** Server-authoritative pick submission — validates everything the client
 * already checks (not eliminated, team not previously used, week still
 * unlocked) again here, since the client check is UX only. Matches
 * Confidence's /api/picks/submit: once a pick exists for the week, any
 * further submission is rejected outright ("Picks already submitted for
 * this week") rather than allowed as a silent change — except during
 * playoffs, where a pick can be changed until the week locks. The change is
 * atomic (replace_survivor_pick RPC): a failed change keeps the old pick. */
export async function submitSurvivorPick(params: {
  participantId: string;
  poolId: string;
  gameId: string;
  selectedTeam: string;
  submittedBy?: string;
  /** Dev-only: bypass the week-lock check below, for testing against a
   * locked or finished game. Real gate is showDebugPanel() (NODE_ENV +
   * NEXT_PUBLIC_SHOW_DEBUG_PANEL), checked server-side here — the caller
   * passing true is not enough by itself, so this can never do anything in
   * production regardless of what a client sends. */
  devForceUnlock?: boolean;
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

  // Dev-only: bypasses both the eliminated/winner lockout below and the
  // week-lock check further down — a developer testing "what if this
  // participant had picked X for this already-decided game" needs both,
  // since by the time a week is locked without a pick, noPickRule=eliminate
  // has typically already eliminated the participant for real.
  const devUnlocked = showDebugPanel() && !!params.devForceUnlock;

  // Status check: cannot pick once eliminated (or once a winner has been
  // determined and the pool is closed).
  const state = await computeSurvivorPoolState(params.poolId);
  const participantState = state.participants.find(p => p.participantId === params.participantId);
  // Blocked if eliminated by current results, or already declared a winner.
  if (!devUnlocked && participantState && (participantState.status !== 'ACTIVE' || participantState.liveStatus !== 'ACTIVE')) {
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
  const unlocked = devUnlocked || computeWeekUnlockStatus(weekGames ?? [], game.week, game.season_type, null);
  if (!unlocked) {
    return { success: false, error: 'This week is locked — picks can no longer be submitted or changed.' };
  }

  // Once a pick exists for this week, reject any further submission —
  // matching Confidence's reject-on-resubmission rule — except during
  // playoffs, which fall through to the atomic replacement below.
  const isPlayoff = game.season_type === 3;
  if (!devUnlocked && !isPlayoff) {
    const { data: existingWeekPick, error: existingWeekPickError } = await supabase
      .from('survivor_picks')
      .select('id')
      .eq('participant_id', params.participantId)
      .eq('pool_id', params.poolId)
      .eq('season', pool.season)
      .eq('season_type', game.season_type)
      .eq('week', game.week)
      .maybeSingle();
    if (existingWeekPickError) return { success: false, error: 'Failed to check existing pick.' };
    if (existingWeekPick) {
      return { success: false, error: 'Picks already submitted for this week.' };
    }
  }

  // Validate everything BEFORE writing anything, so a rejected change (most
  // importantly a playoff pick update) never touches the saved pick. The
  // pick being replaced this week doesn't count as a prior use of its team.
  const { data: existingPicks, error: existingPicksError } = await supabase
    .from('survivor_picks')
    .select('selected_team, season_type, week')
    .eq('participant_id', params.participantId)
    .eq('pool_id', params.poolId)
    .eq('season', pool.season);
  if (existingPicksError) return { success: false, error: 'Failed to verify previously used teams.' };
  const isThisWeek = (p: { season_type: number; week: number }) => p.season_type === game.season_type && p.week === game.week;
  if ((existingPicks ?? []).some(p => p.selected_team === params.selectedTeam && !isThisWeek(p))) {
    return { success: false, error: TEAM_ALREADY_USED_ERROR };
  }

  // Replace (or create) this week's pick in one transaction: the RPC deletes
  // the old pick and inserts the new one, re-checking team reuse under a
  // lock. If anything fails, the previous pick is still saved.
  const { error: replaceError } = await supabase.rpc('replace_survivor_pick', {
    p_participant_id: params.participantId,
    p_pool_id: params.poolId,
    p_game_id: params.gameId,
    p_season: pool.season,
    p_season_type: game.season_type,
    p_week: game.week,
    p_selected_team: params.selectedTeam,
    p_submitted_by: params.submittedBy ?? null,
  });
  if (replaceError) {
    debugError('submitSurvivorPick replace error:', replaceError);
    if (replaceError.message?.includes('SURVIVOR_TEAM_ALREADY_USED')) {
      return { success: false, error: TEAM_ALREADY_USED_ERROR };
    }
    // The UNIQUE constraints are the authoritative backstop even if the
    // pre-checks above raced with a concurrent submission.
    if (replaceError.code === '23505') {
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
export async function finalizeSurvivorSeason(poolId: string): Promise<FinalizeSurvivorSeasonResult | { success: false; error: string; notReady?: true }> {
  const supabase = getSupabaseServiceClient();
  const state = await computeSurvivorPoolState(poolId);

  // Readiness applies to re-finalization too: an outdated result is not a
  // reason to declare a winner that an unfinished game could still change.
  if (!state.finalization.readyToFinalize) {
    return { success: false, notReady: true, error: `This season can't be finalized yet. ${state.finalization.notReadyReason ?? ''}`.trim() };
  }

  const resolved = resolveSurvivorWinners(state.participants, state.settings);
  if (!resolved.success) return resolved;
  const { winnerParticipantIds, resolution } = resolved;

  const { error } = await supabase
    .from('survivor_winners')
    .upsert({
      pool_id: poolId,
      season: state.season,
      winner_participant_ids: winnerParticipantIds,
      resolution,
      determined_at: new Date().toISOString(),
    }, { onConflict: 'pool_id,season' });
  if (error) return { success: false, error: error.message };

  return { success: true, winnerParticipantIds, resolution };
}

export type WinnerCandidate = Pick<SurvivorParticipantState, 'participantId' | 'liveStatus' | 'eliminatedWeek' | 'eliminatedSeasonType' | 'picks'>;

/** Chronological position of an elimination: preseason (1) < regular
 * season (2) < playoffs (3), then week. A playoff week-1 exit outlasts a
 * regular-season week-18 one. */
function eliminationOrder(p: WinnerCandidate): number {
  return (p.eliminatedSeasonType ?? 0) * 100 + (p.eliminatedWeek ?? -1);
}

/** Pure winner resolution from live eligibility. Exported for tests. */
export function resolveSurvivorWinners(
  participants: WinnerCandidate[],
  settings: Pick<SurvivorTypeSettings, 'endOfSeasonRule'>,
): { success: true; winnerParticipantIds: string[]; resolution: string } | { success: false; error: string } {
  // liveStatus only — never the persisted WINNER label. A previous winner
  // whose winning game was corrected to a loss is ELIMINATED here.
  const active = participants.filter(p => p.liveStatus === 'ACTIVE');

  if (active.length === 1) {
    return { success: true, winnerParticipantIds: [active[0].participantId], resolution: 'last_active' };
  }
  if (active.length > 1) {
    return settings.endOfSeasonRule === 'all_remaining_winners'
      ? { success: true, winnerParticipantIds: active.map(p => p.participantId), resolution: 'all_remaining' }
      : { success: true, winnerParticipantIds: pickByMarginTiebreaker(active), resolution: 'margin_tiebreaker' };
  }

  // Wipeout — every participant was eliminated. The "last remaining" group
  // is whoever survived the longest, evaluated with the same end-of-season
  // rule as a normal multi-survivor finish, since they were functionally
  // tied for last-standing.
  const eliminated = participants.filter(p => p.liveStatus === 'ELIMINATED');
  if (eliminated.length === 0) {
    return { success: false, error: 'No participants found for this pool — nothing to finalize.' };
  }
  const last = Math.max(...eliminated.map(eliminationOrder));
  const lastStanding = eliminated.filter(p => eliminationOrder(p) === last);
  if (lastStanding.length === 1) {
    return { success: true, winnerParticipantIds: [lastStanding[0].participantId], resolution: 'wipeout_last_standing' };
  }
  return settings.endOfSeasonRule === 'all_remaining_winners'
    ? { success: true, winnerParticipantIds: lastStanding.map(p => p.participantId), resolution: 'wipeout_all_remaining' }
    : { success: true, winnerParticipantIds: pickByMarginTiebreaker(lastStanding), resolution: 'wipeout_margin_tiebreaker' };
}

function pickByMarginTiebreaker(candidates: WinnerCandidate[]): string[] {
  const totals = candidates.map(p => ({
    id: p.participantId,
    margin: p.picks.reduce((sum, pick) => sum + (pick.result === 'win' ? pick.margin : 0), 0),
  }));
  const maxMargin = Math.max(...totals.map(t => t.margin));
  return totals.filter(t => t.margin === maxMargin).map(t => t.id);
}
