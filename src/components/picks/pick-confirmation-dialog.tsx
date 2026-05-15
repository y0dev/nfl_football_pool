'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, User } from 'lucide-react';
import { Game } from '@/types/game';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE } from '@/lib/utils';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const amber   = 'oklch(72% 0.16 60)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface Pick {
  gameId: string;
  pickedTeamId: string | null;
  confidencePoints: number | null;
}

interface PickConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  picks: Pick[];
  games: Game[];
  weekNumber: number;
  seasonType?: number;
  mondayNightScore?: number | null;
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
  userName: string;
  userEmail?: string;
}

export function PickConfirmationDialog({
  open, onOpenChange, picks, games, weekNumber, seasonType,
  mondayNightScore, onConfirm, isSubmitting, userName, userEmail,
}: PickConfirmationDialogProps) {
  const [userConfirmed, setUserConfirmed] = useState(false);

  const handleConfirm = () => { onConfirm(); setUserConfirmed(false); };

  const getTeamName = (teamId: string) => {
    for (const game of games) {
      if (game.home_team.toString() === teamId) return game.home_team;
      if (game.away_team.toString() === teamId) return game.away_team;
    }
    return 'Unknown Team';
  };

  const sortedPicks = picks
    .filter(pick => pick.pickedTeamId && pick.confidencePoints)
    .sort((a, b) => (b.confidencePoints || 0) - (a.confidencePoints || 0));

  const isPeriodWeek = PERIOD_WEEKS.includes(weekNumber as typeof PERIOD_WEEKS[number]);
  const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE;
  const shouldShowMondayNightScore = (isPeriodWeek || isSuperBowl) && mondayNightScore !== null && mondayNightScore !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '42rem', maxHeight: '80vh', overflowY: 'auto', background: card, border: `1px solid ${border}` }}>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <AlertTriangle style={{ width: 16, height: 16, color: amber }} />
            Confirm Your Picks
          </DialogTitle>
          <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim, marginTop: '0.25rem' }}>
            Please review your Week {weekNumber} picks before submitting. Once submitted, picks cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* User confirmation */}
          <div style={{ padding: '0.85rem 1rem', background: `color-mix(in oklch, ${greenHi} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${greenHi} 25%, ${border})`, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <User style={{ width: 14, height: 14, color: greenHi }} />
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.75rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Submitting as:</span>
            </div>
            <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginBottom: '0.65rem' }}>
              {userName}{userEmail && ` — ${userEmail}`}
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={userConfirmed}
                onChange={(e) => setUserConfirmed(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: green }}
              />
              <span style={{ ...b, fontSize: '0.8rem', color: textMid }}>
                I confirm that I am <strong style={{ color: text }}>{userName}</strong> and these are my picks
              </span>
            </label>
          </div>

          {/* Picks summary */}
          <div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: textMid, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>Your Picks (by confidence):</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {sortedPicks.map((pick) => {
                const game = games.find(g => g.id === pick.gameId);
                if (!game) return null;
                return (
                  <div key={pick.gameId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: surface, border: `1px solid ${border}`, borderRadius: 6 }}>
                    <div>
                      <p style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{getTeamName(pick.pickedTeamId!)}</p>
                      <p style={{ ...b, fontSize: '0.75rem', color: textDim }}>
                        vs {game.home_team?.toString() === pick.pickedTeamId ? game.away_team : game.home_team}
                      </p>
                    </div>
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', color: greenHi, padding: '0.15rem 0.5rem', border: `1px solid color-mix(in oklch, ${greenHi} 40%, ${border})`, borderRadius: 4 }}>
                      {pick.confidencePoints} pts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monday night score */}
          {shouldShowMondayNightScore && (
            <div>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: textMid, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>Monday Night Game Score:</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: `color-mix(in oklch, ${gold} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${gold} 30%, ${border})`, borderRadius: 8 }}>
                <div>
                  <p style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>Total Points Prediction</p>
                  <p style={{ ...b, fontSize: '0.75rem', color: textDim }}>Used for tie-breaking in {isPeriodWeek ? 'tie-breaker week' : 'Super Bowl'}</p>
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: gold }}>{mondayNightScore} pts</span>
              </div>
            </div>
          )}

          {/* Warning */}
          <div style={{ padding: '0.6rem 0.85rem', background: `color-mix(in oklch, ${amber} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${amber} 30%, ${border})`, borderRadius: 6 }}>
            <p style={{ ...b, fontSize: '0.78rem', color: amber }}>
              <strong>Important:</strong> After submission, you cannot change your picks. Make sure all selections are correct before confirming.
            </p>
          </div>
        </div>

        <DialogFooter style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button onClick={() => onOpenChange(false)} disabled={isSubmitting} style={{ ...bc, padding: '0.5rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
            Review Picks
          </button>
          <button onClick={handleConfirm} disabled={!userConfirmed || isSubmitting} style={{ ...bc, padding: '0.5rem 1rem', background: (!userConfirmed || isSubmitting) ? border : green, color: (!userConfirmed || isSubmitting) ? textDim : text, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: (!userConfirmed || isSubmitting) ? 'not-allowed' : 'pointer' }}>
            {isSubmitting ? 'Submitting...' : 'Submit Picks'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
