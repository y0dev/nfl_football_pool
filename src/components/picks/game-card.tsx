'use client';

import { Game, TeamRecord } from '@/types/game';
import { getTeam, getTeamAbbreviation } from '@/lib/utils';
import { TeamLogo } from '@/components/ui/team-logo';
import { Check, Clock, Trophy } from 'lucide-react';
import { format } from 'date-fns';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';
const liveRed = 'oklch(62% 0.22 25)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

// These teams' color2 (their normal pick-distribution bar segment color) is
// too dark/near-black to read against the bar's own dark track — Arizona
// #000000, Atlanta #000000, Carolina #101820, Cincinnati #000000,
// New Orleans #101820, NY Jets #000000, Pittsburgh #101820, Tampa Bay
// #34302B — so they fall back to their brighter primary color instead.
const DARK_SECONDARY_TEAMS = new Set(['ARI', 'ATL', 'CAR', 'CIN', 'NO', 'NYJ', 'PIT', 'TB']);

function pickBarColor(fullTeamName: string): string {
  const team = getTeam(getTeamAbbreviation(fullTeamName));
  return DARK_SECONDARY_TEAMS.has(team.abbreviation) ? team.color : team.color2;
}

export interface GameCardPickState {
  predicted_winner?: string;
  confidence_points?: number;
  is_correct?: boolean;
  points_earned?: number;
}

interface GameCardProps {
  game: Game;
  pick?: GameCardPickState;
  onSelectTeam: (gameId: string, team: string) => void;
  onSetConfidence: (gameId: string, points: number) => void;
  totalGames: number;
  usedPoints: number[];
  locked?: boolean;
  /** Team name -> number of participants who picked that team, e.g.
   * { 'Kansas City Chiefs': 8, 'Buffalo Bills': 4 }. Only ever populated
   * once this game has actually started (see the pick-counts endpoint) —
   * undefined/empty renders nothing, never a 0-0 split. Still drives
   * `isRevealed` (and therefore the pick-buttons/confidence-selector
   * locking) even when showPickDistribution is off — only the bar itself
   * is conditional on that prop. */
  pickCounts?: Record<string, number>;
  /** Show the "How the Pool Picked" distribution bar. Off by default — the
   * bar is Game Results-tab-only; the personal Make Picks view still locks
   * once a game is revealed, it just doesn't render the bar. */
  showPickDistribution?: boolean;
}

function formatRecord(r?: TeamRecord): string {
  if (!r) return '';
  return `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}`;
}

function TeamButton({
  fullName,
  score,
  record,
  isSelected,
  isWinner,
  isFinal,
  isLive,
  isSelectable,
  onClick,
}: {
  fullName: string;
  score?: number | null;
  record?: TeamRecord;
  isSelected: boolean;
  isWinner: boolean;
  isFinal: boolean;
  isLive: boolean;
  isSelectable: boolean;
  onClick: () => void;
}) {
  const abbr = getTeamAbbreviation(fullName);
  const team = getTeam(abbr);
  const mascot = team.name.split(' ').at(-1) ?? team.name;
  const recordLabel = formatRecord(record);

  return (
    <button
      className='team-button'
      onClick={onClick}
      disabled={!isSelectable}
      aria-pressed={isSelected}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.45rem',
        padding: '1rem 0.75rem',
        borderRadius: 10,
        border: 'none',
        background: isSelected ? 'oklch(46% 0.14 155 / 0.1)' : 'transparent',
        outline: isSelected ? '1px solid oklch(46% 0.14 155 / 0.3)' : 'none',
        cursor: isSelectable ? 'pointer' : 'default',
        transition: 'background 0.15s ease, outline 0.15s ease',
      }}
    >
      <TeamLogo
        team={team}
        size="lg"
        colorAccent
        className='team-button-abbr'
        style={{
          boxShadow: isSelected
            ? `0 0 22px ${team.color}55, 0 2px 10px rgba(0,0,0,0.6)`
            : '0 2px 10px rgba(0,0,0,0.45)',
          transition: 'box-shadow 0.2s ease',
        }}
      />
      <span style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: isSelected ? text : textMid, lineHeight: 1.1 }}>
        {team.city}
      </span>
      <span style={{ ...b, fontSize: '0.72rem', color: textDim, lineHeight: 1.1 }}>{mascot}</span>
      {recordLabel && (
        <span style={{ ...b, fontSize: '0.66rem', color: 'oklch(42% 0.015 255)', lineHeight: 1.1 }}>{recordLabel}</span>
      )}
      {isFinal && (
        <span style={{ ...bc, fontWeight: 900, fontSize: '1.15rem', color: isWinner ? text : textDim, marginTop: '0.15rem' }}>
          {score ?? '—'}
        </span>
      )}
      {isLive && score != null && (
        <span style={{ ...bc, fontWeight: 900, fontSize: '1.15rem', color: amber, marginTop: '0.15rem' }}>
          {score}
        </span>
      )}
      {isSelected && !isFinal && !isLive && <Check size={13} color={greenHi} />}
    </button>
  );
}

export function GameCard({ game, pick, onSelectTeam, onSetConfidence, totalGames, usedPoints, locked, pickCounts, showPickDistribution }: GameCardProps) {
  const isFinal = game.status === 'finished' || game.status === 'cancelled';
  const isLive = game.status === 'in_progress' || game.status === 'live';
  const selectedTeam = pick?.predicted_winner;
  const confidencePoints = pick?.confidence_points;

  const awayPickCount = pickCounts?.[game.away_team] ?? 0;
  const homePickCount = pickCounts?.[game.home_team] ?? 0;
  const totalPickers = awayPickCount + homePickCount;
  const awayPickPct = totalPickers > 0 ? Math.round((awayPickCount / totalPickers) * 100) : 0;
  const homePickPct = totalPickers > 0 ? 100 - awayPickPct : 0;
  // pickCounts is only ever populated once this game is revealable — either
  // it's started, or every participant has submitted for the week (see the
  // pick-counts endpoint) — so its presence doubles as "no more editing for
  // this game": once revealed, the pick-buttons/confidence-selector give way
  // to the read-only distribution below, even for a game that technically
  // hasn't kicked off yet.
  const isRevealed = totalPickers > 0;
  const isSelectable = !locked && !isFinal && !isLive && !isRevealed;

  // Every value 1..totalGames is always shown. A value used on another game
  // stays tappable — picking it here moves it over and swaps this game's
  // current value onto that game (see handleSetConfidence in weekly-pick.tsx).
  const allPoints = Array.from({ length: totalGames }, (_, i) => i + 1);

  let kickoffLabel = '';
  try {
    kickoffLabel = format(new Date(game.kickoff_time), 'EEE MMM d, h:mm a');
  } catch {
    kickoffLabel = game.kickoff_time;
  }

  const winnerCity = game.winner ? getTeam(getTeamAbbreviation(game.winner)).city : null;

  return (
    <div
      className='game-card'
      style={{
        background: card,
        border: `1px solid ${selectedTeam ? 'oklch(46% 0.14 155 / 0.4)' : border}`,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
        opacity: locked ? 0.85 : 1,
      }}
    >
      {/* Header */}
      <div
        className='game-card-header'
        style={{
          padding: '0.5rem 1.125rem',
          background: surface,
          borderBottom: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <div
          className='game-card-kickoff'
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', ...b, fontSize: '0.75rem', color: textDim }}>
          {isFinal ? (
            <>
              <Trophy size={12} color={amber} />
              <span style={{ color: amber }}>Final</span>
            </>
          ) : isLive ? (
            <>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: liveRed, flexShrink: 0, animation: 'pulse 1.4s ease-in-out infinite' }} />
              <span style={{ color: liveRed, fontWeight: 700 }}>Live</span>
            </>
          ) : (
            <>
              <Clock size={12} />
              {kickoffLabel}
            </>
          )}
        </div>
        <div
          className='game-card-results'
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isFinal && winnerCity && (
            <span style={{ ...bc, fontSize: '0.75rem', fontWeight: 700, color: greenHi }}>
              {winnerCity} wins
            </span>
          )}
          {isFinal && !winnerCity && game.home_score != null && game.away_score != null && game.home_score === game.away_score && (
            <span style={{ ...bc, fontSize: '0.75rem', fontWeight: 700, color: amber }}>
              Draw
            </span>
          )}
          {pick?.is_correct === true && (
            <span style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, color: greenHi, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <Check size={10} /> +{pick.points_earned}
            </span>
          )}
          {pick?.is_correct === false && (
            <span style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, color: liveRed }}>Missed</span>
          )}
        </div>
      </div>

      {/* Teams row */}
      <div
        className='game-card-teams'
        style={{ padding: '0.875rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <TeamButton
          fullName={game.away_team}
          score={game.away_score}
          record={game.away_team_record}
          isSelected={selectedTeam === game.away_team}
          isWinner={game.winner === game.away_team}
          isFinal={isFinal}
          isLive={isLive}
          isSelectable={isSelectable}
          onClick={() => isSelectable && onSelectTeam(game.id, game.away_team)}
        />
        <div
          className='game-card-vs'
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', flexShrink: 0, padding: '0 0.25rem' }}>
          <span style={{ ...bc, fontWeight: 800, fontSize: '0.7rem', color: textDim, letterSpacing: '0.12em' }}>VS</span>
          <span style={{ ...b, fontSize: '0.6rem', color: 'oklch(34% 0.02 255)' }}>@</span>
        </div>
        <TeamButton
          fullName={game.home_team}
          score={game.home_score}
          record={game.home_team_record}
          isSelected={selectedTeam === game.home_team}
          isWinner={game.winner === game.home_team}
          isFinal={isFinal}
          isLive={isLive}
          isSelectable={isSelectable}
          onClick={() => isSelectable && onSelectTeam(game.id, game.home_team)}
        />
      </div>

      {/* Pick distribution — how the pool picked this game. Game Results-tab
          only (showPickDistribution): the pick-counts endpoint is the sole
          authority on WHETHER this is revealable at all (once the game has
          started, or once every participant has submitted for the week —
          pickCounts is simply empty until then), but the personal Make
          Picks view intentionally never renders the bar itself, only the
          resulting lock (see isRevealed above). */}
      {showPickDistribution && totalPickers > 0 && (
        <div className='game-card-pick-distribution' style={{ padding: '0 1rem 0.875rem' }}>
          <p style={{ ...b, fontSize: '0.65rem', color: textDim, textAlign: 'center', marginBottom: '0.35rem' }}>
            How the Pool Picked
          </p>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'oklch(26% 0.03 255)' }}>
            {awayPickCount > 0 && (
              <div style={{ width: `${awayPickPct}%`, background: pickBarColor(game.away_team) }} />
            )}
            {homePickCount > 0 && (
              <div style={{ width: `${homePickPct}%`, background: pickBarColor(game.home_team) }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
            <span style={{ ...b, fontSize: '0.7rem', color: textMid }}>
              {getTeamAbbreviation(game.away_team)} {awayPickCount} ({awayPickPct}%)
            </span>
            <span style={{ ...b, fontSize: '0.7rem', color: textMid }}>
              {getTeamAbbreviation(game.home_team)} {homePickCount} ({homePickPct}%)
            </span>
          </div>
        </div>
      )}

      {/* Confidence selector — hidden once revealed, same as the pick
          buttons above: seeing the crowd's picks and still being able to
          change your own at the same time is exactly what "revealed" is
          meant to prevent. */}
      {selectedTeam && !isFinal && !isLive && !locked && !isRevealed && (
        <div className='game-card-confidence' style={{ padding: '0 1rem 1rem' }}>
          <p style={{ ...b, fontSize: '0.68rem', color: textDim, textAlign: 'center', marginBottom: '0.5rem', marginTop: 0 }}>
            Confidence Points
          </p>
          <div
            className='game-card-confidence-options'
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'center' }}>
            {allPoints.map(p => {
              const isSelected = confidencePoints === p;
              const isTaken = usedPoints.includes(p);
              return (
                <button
                  key={p}
                  type='button'
                  onClick={() => onSetConfidence(game.id, p)}
                  aria-pressed={isSelected}
                  title={
                    isSelected
                      ? 'Assigned to this game — tap to clear it'
                      : isTaken
                      ? 'Used on another game — tap to move it here'
                      : `Assign ${p} confidence point${p === 1 ? '' : 's'}`
                  }
                  style={{
                    position: 'relative',
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    border: isTaken && !isSelected ? '1px dashed oklch(42% 0.02 255)' : '1px solid transparent',
                    background: isSelected ? green : 'oklch(26% 0.03 255)',
                    color: isSelected ? '#fff' : isTaken ? textDim : textMid,
                    opacity: isTaken && !isSelected ? 0.5 : 1,
                    cursor: 'pointer',
                    transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                    boxShadow: isSelected ? `0 3px 10px ${green}55` : 'none',
                    transition: 'background 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease',
                    ...bc,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                  }}
                >
                  {p}
                  {isTaken && !isSelected && (
                    <span
                      aria-hidden='true'
                      style={{ position: 'absolute', top: -5, right: -5, fontSize: '0.6rem', lineHeight: 1, color: amber, fontWeight: 700 }}
                    >
                      ⇄
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p style={{ ...b, fontSize: '0.62rem', color: textDim, textAlign: 'center', margin: '0.5rem 0 0' }}>
            Tap a dimmed <span style={{ color: amber }}>⇄</span> number to move it here (your current one swaps over). Tap your own number to clear it.
          </p>
        </div>
      )}

      {/* Points badge — final only. A locked-but-not-final game either shows
          the pick-distribution above (once it's revealed) or nothing yet; a
          static, uncolored point count with no correct/incorrect signal
          wasn't earning its place there. */}
      {!!confidencePoints && isFinal && (
        <div className='game-card-points' style={{ padding: '0 1rem 0.875rem', textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '0.2rem 0.75rem',
              borderRadius: 20,
              ...bc,
              fontWeight: 700,
              fontSize: '0.72rem',
              background:
                pick?.is_correct === true
                  ? 'oklch(46% 0.14 155 / 0.15)'
                  : pick?.is_correct === false
                  ? 'oklch(62% 0.22 25 / 0.15)'
                  : 'oklch(26% 0.03 255)',
              color:
                pick?.is_correct === true
                  ? greenHi
                  : pick?.is_correct === false
                  ? liveRed
                  : textMid,
            }}
          >
            {confidencePoints} pts
          </span>
        </div>
      )}
    </div>
  );
}
