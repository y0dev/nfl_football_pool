import type { NFLGame } from './nfl-api';
import { normalizeGameStatus } from '@/types/game';

// Diff engine for the Manual NFL Data Sync preview/approval workflow
// (src/app/api/admin/nfl-sync/{preview,apply}/route.ts). Pure functions,
// no I/O — takes NFL-provider data and the corresponding `games` rows and
// produces proposed changes, never writing anything itself. Matching is
// always by the external game id (the provider's own stable event id,
// already the `games.id` primary key — see games.upsert(..., { onConflict:
// 'id' }) throughout this codebase), never home+away+date.

export interface DbGameRow {
  id: string;
  week: number;
  season: number;
  season_type: number;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  home_score: number | null;
  away_score: number | null;
  winner: string | null;
  status: string;
  home_team_id: string | null;
  away_team_id: string | null;
}

export type ChangeType = 'new' | 'updated';

export interface FieldDiff {
  old: unknown;
  new: unknown;
}

export interface ProposedChange {
  externalGameId: string;
  changeType: ChangeType;
  fieldDiffs: Record<string, FieldDiff>;
  proposedPayload: Record<string, unknown>;
  /** Relevant DbGameRow fields at preview time — null for 'new' games (there
   * was nothing to snapshot). Used by the apply step to detect the database
   * moved since this preview was generated. */
  baseSnapshot: Record<string, unknown> | null;
  /** Human-readable summary for the UI, e.g. "Kickoff changed", "Score: 14-10 → 21-17". */
  summaryLines: string[];
}

export interface SyncPreviewSummary {
  gamesChecked: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
}

function computeWinner(status: string, homeTeam: string, awayTeam: string, homeScore: number | null, awayScore: number | null): string | null {
  if (normalizeGameStatus(status) !== 'finished') return null;
  if (homeScore == null || awayScore == null) return null;
  if (homeScore > awayScore) return homeTeam;
  if (awayScore > homeScore) return awayTeam;
  return null; // tie
}

function buildProposedPayload(game: NFLGame): Record<string, unknown> {
  const status = normalizeGameStatus(game.status);
  // ESPN returns score: "0" (not null/omitted) for games that haven't
  // kicked off yet — treating that as a real 0-0 score generates a fake
  // "Score changed" proposal for every scheduled game on every sync (Step
  // 2/9: never assume 0-0 means anything unless status actually says so).
  const homeScore = status === 'scheduled' ? null : (game.home_score ?? null);
  const awayScore = status === 'scheduled' ? null : (game.away_score ?? null);
  return {
    id: game.id,
    week: game.week,
    season: game.season,
    season_type: game.season_type,
    home_team: game.home_team,
    away_team: game.away_team,
    kickoff_time: game.time,
    home_score: homeScore,
    away_score: awayScore,
    winner: computeWinner(status, game.home_team, game.away_team, homeScore, awayScore),
    status,
    home_team_id: game.home_team_id ?? null,
    away_team_id: game.away_team_id ?? null,
    is_active: true,
  };
}

function snapshotRelevantFields(row: DbGameRow): Record<string, unknown> {
  return {
    kickoff_time: row.kickoff_time,
    home_score: row.home_score,
    away_score: row.away_score,
    winner: row.winner,
    status: normalizeGameStatus(row.status),
    home_team: row.home_team,
    away_team: row.away_team,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
  };
}

/** Diffs one incoming NFL game against its existing DB row (if any).
 * Returns null when nothing meaningful changed — the caller should not
 * write anything and should count it as unchanged, not "updated". */
export function diffGame(incoming: NFLGame, existing: DbGameRow | null): ProposedChange | null {
  const proposedPayload = buildProposedPayload(incoming);

  if (!existing) {
    return {
      externalGameId: incoming.id,
      changeType: 'new',
      fieldDiffs: {},
      proposedPayload,
      baseSnapshot: null,
      summaryLines: [`New game: ${incoming.away_team} @ ${incoming.home_team}`],
    };
  }

  const before = snapshotRelevantFields(existing);
  const fieldDiffs: Record<string, FieldDiff> = {};
  const summaryLines: string[] = [];

  const kickoffChanged = new Date(before.kickoff_time as string).getTime() !== new Date(proposedPayload.kickoff_time as string).getTime();
  if (kickoffChanged) {
    fieldDiffs.kickoff_time = { old: before.kickoff_time, new: proposedPayload.kickoff_time };
    summaryLines.push('Kickoff time changed');
  }

  if (before.status !== proposedPayload.status) {
    fieldDiffs.status = { old: before.status, new: proposedPayload.status };
    summaryLines.push(`Status changed: ${before.status} → ${proposedPayload.status}`);
  }

  if (before.home_score !== proposedPayload.home_score || before.away_score !== proposedPayload.away_score) {
    fieldDiffs.home_score = { old: before.home_score, new: proposedPayload.home_score };
    fieldDiffs.away_score = { old: before.away_score, new: proposedPayload.away_score };
    summaryLines.push(`Score changed: ${before.away_score ?? '–'}-${before.home_score ?? '–'} → ${proposedPayload.away_score ?? '–'}-${proposedPayload.home_score ?? '–'}`);
  }

  if (before.winner !== proposedPayload.winner) {
    fieldDiffs.winner = { old: before.winner, new: proposedPayload.winner };
  }

  for (const field of ['home_team', 'away_team', 'home_team_id', 'away_team_id'] as const) {
    if (before[field] !== proposedPayload[field]) {
      fieldDiffs[field] = { old: before[field], new: proposedPayload[field] };
      summaryLines.push(`${field.replace('_', ' ')} changed`);
    }
  }

  if (Object.keys(fieldDiffs).length === 0) return null;

  return {
    externalGameId: incoming.id,
    changeType: 'updated',
    fieldDiffs,
    proposedPayload,
    baseSnapshot: before,
    summaryLines,
  };
}

export function buildSyncPreview(
  incomingGames: NFLGame[],
  existingRows: DbGameRow[]
): { changes: ProposedChange[]; summary: SyncPreviewSummary } {
  const existingById = new Map(existingRows.map(r => [r.id, r]));
  const changes: ProposedChange[] = [];
  let unchangedCount = 0;

  for (const game of incomingGames) {
    const change = diffGame(game, existingById.get(game.id) ?? null);
    if (change) {
      changes.push(change);
    } else {
      unchangedCount++;
    }
  }

  return {
    changes,
    summary: {
      gamesChecked: incomingGames.length,
      newCount: changes.filter(c => c.changeType === 'new').length,
      updatedCount: changes.filter(c => c.changeType === 'updated').length,
      unchangedCount,
    },
  };
}

const SNAPSHOT_FIELDS = ['kickoff_time', 'home_score', 'away_score', 'winner', 'status', 'home_team', 'away_team', 'home_team_id', 'away_team_id'] as const;

function snapshotValuesEqual(field: string, a: unknown, b: unknown): boolean {
  // kickoff_time round-trips through Postgres/JSONB as a different but
  // equivalent string representation (e.g. trailing 'Z' vs '+00:00') — a
  // strict string/JSON.stringify comparison would false-positive as stale
  // on every single change, same class of bug as the diff engine's own
  // kickoff comparison above.
  if (field === 'kickoff_time' && a != null && b != null) {
    return new Date(a as string).getTime() === new Date(b as string).getTime();
  }
  return a === b;
}

/** Order-independent snapshot equality — base_snapshot round-trips through
 * a JSONB column, and Postgres does not guarantee object key order is
 * preserved, so a naive JSON.stringify comparison can false-positive as
 * stale even when nothing actually changed. */
function snapshotsEqual(a: Record<string, unknown> | null, b: Record<string, unknown> | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return SNAPSHOT_FIELDS.every(field => snapshotValuesEqual(field, a[field], b[field]));
}

/** Re-checks a proposed change's baseSnapshot against the CURRENT games row
 * before applying it — used by the apply endpoint to refuse a stale
 * approval (the DB moved since the preview was generated). 'new' changes
 * (baseSnapshot null) are stale if the game now exists when it didn't
 * before; otherwise never stale (nothing to have moved). */
export function isChangeStale(change: { changeType: ChangeType; baseSnapshot: Record<string, unknown> | null }, currentRow: DbGameRow | null): boolean {
  if (change.changeType === 'new') {
    return currentRow !== null;
  }
  if (!currentRow) return true; // was updated, now deleted entirely
  const currentSnapshot = snapshotRelevantFields(currentRow);
  return !snapshotsEqual(currentSnapshot, change.baseSnapshot);
}
