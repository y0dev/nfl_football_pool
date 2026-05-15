'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Target } from 'lucide-react';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE } from '@/lib/utils';
import { Game } from '@/types/game';
import { getMondayNightGameInfo } from '@/lib/monday-night-utils';

// Design tokens
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface MondayNightScoreInputProps {
  poolId: string;
  weekNumber: number;
  seasonType: number;
  participantId: string;
  initialScore?: number;
  onScoreChange: (score: number | null) => void;
  isRequired?: boolean;
  games?: Game[];
  isLocked?: boolean;
}

export function MondayNightScoreInput({
  poolId: _poolId,
  weekNumber,
  seasonType,
  participantId: _participantId,
  initialScore,
  onScoreChange,
  isRequired = false,
  games = [],
  isLocked = false
}: MondayNightScoreInputProps) {
  const [score, setScore] = useState<number | null>(initialScore || null);
  const [isValid, setIsValid] = useState(true);

  // Check if this is a period week where tie breakers are used
  const isPeriodWeek = PERIOD_WEEKS.includes(weekNumber as typeof PERIOD_WEEKS[number]);
  // Super Bowl is week 4 in playoffs (seasonType 3)
  const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE && weekNumber === 4;
  const shouldShowInput = isPeriodWeek || isSuperBowl;

  // Get Monday night game info
  const mondayNightGameInfo = getMondayNightGameInfo(games);

  useEffect(() => {
    onScoreChange(score);
  }, [score, onScoreChange]);

  const handleScoreChange = (value: string) => {
    const numericValue = value === '' ? null : parseInt(value, 10);

    // Validate score (reasonable range for NFL game scores)
    if (numericValue !== null) {
      if (numericValue < 0 || numericValue > 100) {
        setIsValid(false);
      } else {
        setIsValid(true);
      }
    } else {
      setIsValid(true);
    }

    setScore(numericValue);
  };

  if (!shouldShowInput) {
    return null;
  }

  // Determine title and description based on context
  const isSuperBowlContext = isSuperBowl;
  const title = isSuperBowlContext ? 'Super Bowl Score' : 'Monday Night Game Score';
  const description = isSuperBowlContext
    ? 'Enter your prediction for the total points scored in the Super Bowl. This will be used as a tie-breaker if needed.'
    : mondayNightGameInfo
      ? <>Enter your prediction for the total points scored in Monday night&apos;s game: <strong style={{ color: text }}>{mondayNightGameInfo.displayText}</strong>. This will be used as a tie-breaker if needed.</>
      : <>Enter your prediction for the total points scored in Monday night&apos;s game. This will be used as a tie-breaker if needed.</>;

  return (
    <div style={{
      background: card,
      border: `1px solid ${amber}`,
      borderRadius: 8,
      padding: '1.25rem',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Target style={{ width: 18, height: 18, color: amber, flexShrink: 0 }} />
          <span style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {title}
          </span>
          {isRequired && (
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.08em', padding: '0.1rem 0.4rem', borderRadius: 4, background: 'oklch(72% 0.16 60 / 0.2)', color: amber, border: `1px solid oklch(72% 0.16 60 / 0.4)`, textTransform: 'uppercase' }}>
              Required
            </span>
          )}
        </div>
        <p style={{ ...b, fontSize: '0.8rem', color: textMid, lineHeight: 1.5 }}>
          {description}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Monday Night Game Info */}
        {mondayNightGameInfo && (
          <div style={{
            background: 'oklch(17% 0.028 255)',
            border: `1px solid ${border}`,
            borderRadius: 6,
            padding: '0.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <Clock style={{ width: 14, height: 14, color: amber, flexShrink: 0 }} />
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: amber, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Monday Night Game
              </span>
            </div>
            <div style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text }}>
              {mondayNightGameInfo.displayText}
            </div>
            <div style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>
              Kickoff: {new Date(mondayNightGameInfo.game.kickoff_time).toLocaleString()}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="monday-night-score" style={{ ...b, fontSize: '0.8rem', fontWeight: 600, color: textMid, display: 'block', marginBottom: '0.4rem' }}>
            Total Points Scored
            {isRequired && <span style={{ color: 'oklch(62% 0.22 25)', marginLeft: '0.25rem' }}>*</span>}
          </Label>
          <Input
            id="monday-night-score"
            type="number"
            min="0"
            max="100"
            step="1"
            placeholder="e.g., 45"
            value={score || ''}
            onChange={(e) => handleScoreChange(e.target.value)}
            style={{
              background: 'oklch(17% 0.028 255)',
              border: `1px solid ${!isValid ? 'oklch(62% 0.22 25)' : border}`,
              color: text,
              borderRadius: 6,
            }}
            disabled={isLocked}
          />
          {!isValid && (
            <p style={{ ...b, fontSize: '0.75rem', color: 'oklch(62% 0.22 25)', marginTop: '0.35rem' }}>
              Please enter a score between 0 and 100
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock style={{ width: 13, height: 13, color: textDim, flexShrink: 0 }} />
          <span style={{ ...b, fontSize: '0.75rem', color: textDim }}>
            {isSuperBowlContext
              ? 'Used for tie-breaking in the Super Bowl (playoffs)'
              : `Used for tie-breaking in tie-breaker weeks (${PERIOD_WEEKS.join(', ')})`}
          </span>
        </div>

        {score !== null && isValid && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.2rem 0.6rem',
            background: 'oklch(46% 0.14 155 / 0.15)',
            border: `1px solid oklch(46% 0.14 155 / 0.4)`,
            borderRadius: 5,
            width: 'fit-content',
          }}>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: greenHi }}>
              Score: {score} points
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
