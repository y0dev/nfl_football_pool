'use client';

import { Game } from '@/types/game';
import { getTeam, getTeamAbbreviation } from '@/lib/utils';
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
}

function TeamButton({
  fullName,
  score,
  isSelected,
  isWinner,
  isFinal,
  isSelectable,
  onClick,
}: {
  fullName: string;
  score?: number | null;
  isSelected: boolean;
  isWinner: boolean;
  isFinal: boolean;
  isSelectable: boolean;
  onClick: () => void;
}) {
  const abbr = getTeamAbbreviation(fullName);
  const team = getTeam(abbr);
  const mascot = team.name.split(' ').at(-1) ?? team.name;

  return (
    <button
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
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: team.color,
          borderBottom: `6px solid ${team.color2}`,
          boxShadow: isSelected
            ? `0 0 22px ${team.color}55, 0 2px 10px rgba(0,0,0,0.6)`
            : '0 2px 10px rgba(0,0,0,0.45)',
          transition: 'box-shadow 0.2s ease',
          ...bc,
          fontWeight: 900,
          fontSize: '0.88rem',
          letterSpacing: '0.03em',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {team.abbreviation}
      </div>
      <span style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: isSelected ? text : textMid, lineHeight: 1.1 }}>
        {team.city}
      </span>
      <span style={{ ...b, fontSize: '0.72rem', color: textDim, lineHeight: 1.1 }}>{mascot}</span>
      {isFinal && (
        <span style={{ ...bc, fontWeight: 900, fontSize: '1.15rem', color: isWinner ? text : textDim, marginTop: '0.15rem' }}>
          {score ?? '—'}
        </span>
      )}
      {isSelected && !isFinal && <Check size={13} color={greenHi} />}
    </button>
  );
}

export function GameCard({ game, pick, onSelectTeam, onSetConfidence, totalGames, usedPoints, locked }: GameCardProps) {
  const isFinal = game.status === 'final' || game.status === 'post';
  const isSelectable = !locked && !isFinal;
  const selectedTeam = pick?.predicted_winner;
  const confidencePoints = pick?.confidence_points;

  const availablePoints = Array.from({ length: totalGames }, (_, i) => i + 1).filter(
    p => !usedPoints.includes(p) || p === confidencePoints
  );

  let kickoffLabel = '';
  try {
    kickoffLabel = format(new Date(game.kickoff_time), 'EEE MMM d, h:mm a');
  } catch {
    kickoffLabel = game.kickoff_time;
  }

  const winnerCity = game.winner ? getTeam(getTeamAbbreviation(game.winner)).city : null;

  return (
    <div
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', ...b, fontSize: '0.75rem', color: textDim }}>
          {isFinal ? (
            <>
              <Trophy size={12} color={amber} />
              <span style={{ color: amber }}>Final</span>
            </>
          ) : (
            <>
              <Clock size={12} />
              {kickoffLabel}
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isFinal && winnerCity && (
            <span style={{ ...bc, fontSize: '0.75rem', fontWeight: 700, color: greenHi }}>
              {winnerCity} wins
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
      <div style={{ padding: '0.875rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <TeamButton
          fullName={game.away_team}
          score={game.away_score}
          isSelected={selectedTeam === game.away_team}
          isWinner={game.winner === game.away_team}
          isFinal={isFinal}
          isSelectable={isSelectable}
          onClick={() => isSelectable && onSelectTeam(game.id, game.away_team)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', flexShrink: 0, padding: '0 0.25rem' }}>
          <span style={{ ...bc, fontWeight: 800, fontSize: '0.7rem', color: textDim, letterSpacing: '0.12em' }}>VS</span>
          <span style={{ ...b, fontSize: '0.6rem', color: 'oklch(34% 0.02 255)' }}>@</span>
        </div>
        <TeamButton
          fullName={game.home_team}
          score={game.home_score}
          isSelected={selectedTeam === game.home_team}
          isWinner={game.winner === game.home_team}
          isFinal={isFinal}
          isSelectable={isSelectable}
          onClick={() => isSelectable && onSelectTeam(game.id, game.home_team)}
        />
      </div>

      {/* Confidence selector */}
      {selectedTeam && !isFinal && !locked && (
        <div style={{ padding: '0 1rem 1rem' }}>
          <p style={{ ...b, fontSize: '0.68rem', color: textDim, textAlign: 'center', marginBottom: '0.5rem', marginTop: 0 }}>
            Confidence Points
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'center' }}>
            {availablePoints.map(p => (
              <button
                key={p}
                onClick={() => onSetConfidence(game.id, p)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 7,
                  border: 'none',
                  background: confidencePoints === p ? green : 'oklch(26% 0.03 255)',
                  color: confidencePoints === p ? '#fff' : textMid,
                  cursor: 'pointer',
                  transform: confidencePoints === p ? 'scale(1.12)' : 'scale(1)',
                  boxShadow: confidencePoints === p ? `0 3px 10px ${green}55` : 'none',
                  transition: 'background 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease',
                  ...bc,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Points badge when locked or final */}
      {confidencePoints && (isFinal || locked) && (
        <div style={{ padding: '0 1rem 0.875rem', textAlign: 'center' }}>
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
