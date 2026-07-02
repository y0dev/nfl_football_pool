'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Eye, Lock, Unlock, Target, RefreshCw } from 'lucide-react';
import { Game } from '@/types/game';
import { getShortTeamName, debugError} from '@/lib/utils';

// Design tokens
const bg      = 'oklch(13% 0.025 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const liveRed = 'oklch(62% 0.22 25)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface RecentPicksViewerProps {
  poolId: string;
  participantId: string;
  participantName: string;
  weekNumber: number;
  seasonType: number;
  games: Game[];
  canUnlock: boolean;
  onUnlock: (participantId: string) => Promise<void>;
}

interface Pick {
  id: string;
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
  created_at: string;
}

export function RecentPicksViewer({
  poolId,
  participantId,
  participantName,
  weekNumber,
  seasonType,
  games,
  canUnlock,
  onUnlock
}: RecentPicksViewerProps) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRecentPicks();
  }, [poolId, participantId, weekNumber, seasonType]);

  const loadRecentPicks = async () => {
    try {
      setIsLoading(true);
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('picks')
        .select(`
          id,
          game_id,
          predicted_winner,
          confidence_points,
          created_at,
          games!inner(week, season_type, home_team, away_team, kickoff_time)
        `)
        .eq('participant_id', participantId)
        .eq('pool_id', poolId)
        .eq('games.week', weekNumber)
        .eq('games.season_type', seasonType)
        .order('confidence_points', { ascending: false });

      if (error) {
        throw error;
      }

      setPicks(data || []);
    } catch (error) {
      debugError('Error loading recent picks:', error);
      toast({
        title: "Error",
        description: "Failed to load recent picks",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async () => {
    setIsUnlocking(true);
    try {
      await onUnlock(participantId);
      setPicks([]); // Clear picks after unlock
    } finally {
      setIsUnlocking(false);
    }
  };

  const getSeasonTypeName = (seasonType: number) => {
    switch (seasonType) {
      case 1: return 'Preseason';
      case 2: return 'Regular Season';
      case 3: return 'Postseason';
      default: return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ height: 12, background: 'oklch(26% 0.03 255)', borderRadius: 4, width: '33%', animation: 'pulse 1.5s ease-in-out infinite' }} />
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 36, background: 'oklch(26% 0.03 255)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  if (picks.length === 0) {
    return (
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.5rem', textAlign: 'center' }}>
        <Target style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.5rem' }} />
        <p style={{ ...b, fontSize: '0.85rem', color: textDim }}>No picks found for this week</p>
      </div>
    );
  }

  const totalPoints = picks.reduce((sum, pick) => sum + pick.confidence_points, 0);
  const submittedAt = new Date(picks[0]?.created_at || '');

  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Eye style={{ width: 16, height: 16, color: textMid, flexShrink: 0 }} />
            <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Picks — {participantName}
            </span>
          </div>
          <p style={{ ...b, fontSize: '0.75rem', color: textDim }}>
            Week {weekNumber} &bull; {getSeasonTypeName(seasonType)} &bull; Submitted {submittedAt.toLocaleString()}
          </p>
        </div>
        {canUnlock && (
          <button
            onClick={handleUnlock}
            disabled={isUnlocking}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.35rem 0.7rem',
              background: isUnlocking ? 'oklch(26% 0.03 255)' : 'transparent',
              color: isUnlocking ? textDim : textMid,
              border: `1px solid ${border}`,
              borderRadius: 5,
              ...bc, fontWeight: 600, fontSize: '0.7rem',
              letterSpacing: '0.07em', textTransform: 'uppercase',
              cursor: isUnlocking ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            {isUnlocking ? (
              <RefreshCw style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
            ) : (
              <Unlock style={{ width: 12, height: 12 }} />
            )}
            {isUnlocking ? 'Unlocking...' : 'Unlock Picks'}
          </button>
        )}
      </div>

      <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Summary */}
        <div style={{
          background: 'oklch(17% 0.028 255)',
          border: `1px solid ${border}`,
          borderRadius: 6,
          padding: '0.85rem 1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ ...b, fontSize: '0.72rem', color: textDim, marginBottom: '0.2rem' }}>Total Confidence Points</div>
            <div style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: greenHi, lineHeight: 1 }}>{totalPoints}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...b, fontSize: '0.72rem', color: textDim, marginBottom: '0.2rem' }}>Games Picked</div>
            <div style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: greenHi, lineHeight: 1 }}>{picks.length}</div>
          </div>
        </div>

        {/* Picks List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {picks.map((pick) => {
            const game = games.find(g => g.id === pick.game_id);
            if (!game) return null;

            const isCorrect = game.winner && pick.predicted_winner === game.winner;
            const isWrong = game.winner && pick.predicted_winner !== game.winner;

            return (
              <div
                key={pick.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  background: 'oklch(17% 0.028 255)',
                  border: `1px solid ${isCorrect ? 'oklch(46% 0.14 155 / 0.4)' : isWrong ? 'oklch(62% 0.22 25 / 0.35)' : border}`,
                  borderRadius: 6,
                  gap: '0.75rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                    {/* Confidence badge */}
                    <span style={{
                      ...bc, fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.05em',
                      padding: '0.1rem 0.4rem', borderRadius: 4,
                      background: 'oklch(26% 0.03 255)', color: textMid,
                      border: `1px solid ${border}`, textTransform: 'uppercase',
                    }}>
                      {pick.confidence_points} pts
                    </span>
                    <span style={{ ...b, fontSize: '0.82rem', color: textMid }}>
                      {game.away_team} @ {game.home_team}
                    </span>
                  </div>
                  <div style={{ ...b, fontSize: '0.78rem', color: textDim }}>
                    Pick: <span style={{ color: text, fontWeight: 600 }}>{pick.predicted_winner}</span>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {game.winner && (
                    <span style={{
                      ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.07em',
                      padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase',
                      background: isCorrect ? 'oklch(46% 0.14 155 / 0.2)' : 'oklch(62% 0.22 25 / 0.15)',
                      color: isCorrect ? greenHi : liveRed,
                      border: `1px solid ${isCorrect ? 'oklch(46% 0.14 155 / 0.4)' : 'oklch(62% 0.22 25 / 0.35)'}`,
                    }}>
                      {isCorrect ? '✓ Correct' : '✗ Wrong'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lock Status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 0.85rem',
          background: 'oklch(17% 0.028 255)',
          border: `1px solid ${border}`,
          borderRadius: 6,
        }}>
          <Lock style={{ width: 13, height: 13, color: textDim, flexShrink: 0 }} />
          <span style={{ ...b, fontSize: '0.75rem', color: textDim }}>
            Picks are locked and cannot be modified
          </span>
        </div>
      </div>
    </div>
  );
}
