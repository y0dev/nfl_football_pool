'use client';

import { useState, useMemo } from 'react';
import { Game, Pick } from '@/types/game';
import { GameCard, GameCardPickState } from './game-card';
import { submitPicks } from '@/actions/submitPicks';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2 } from 'lucide-react';

const green   = 'oklch(46% 0.14 155)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

type PickMap = Record<string, GameCardPickState>;

interface PickEntryProps {
  poolId: string;
  weekNumber: number;
  seasonType: number;
  games: Game[];
  participantId: string;
  participantName: string;
  locked?: boolean;
  existingPicks?: Pick[];
  onPicksSubmitted?: () => void;
}

export function PickEntry({
  poolId,
  weekNumber,
  seasonType,
  games,
  participantId,
  participantName,
  locked,
  existingPicks,
  onPicksSubmitted,
}: PickEntryProps) {
  const { toast } = useToast();

  const initialPicks = useMemo<PickMap>(() => {
    const map: PickMap = {};
    existingPicks?.forEach(p => {
      map[p.game_id] = {
        predicted_winner: p.predicted_winner || undefined,
        confidence_points: p.confidence_points || undefined,
      };
    });
    return map;
  }, [existingPicks]);

  const [picks, setPicks] = useState<PickMap>(initialPicks);
  const [saving, setSaving] = useState(false);

  const allFinal = games.length > 0 && games.every(g => g.status === 'final' || g.status === 'post');
  const isLocked = locked || allFinal;

  const handleSelectTeam = (gameId: string, team: string) => {
    setPicks(prev => ({ ...prev, [gameId]: { ...prev[gameId], predicted_winner: team } }));
  };

  const handleSetConfidence = (gameId: string, points: number) => {
    setPicks(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(gid => {
        if (next[gid]?.confidence_points === points && gid !== gameId) {
          next[gid] = { ...next[gid], confidence_points: undefined };
        }
      });
      next[gameId] = { ...next[gameId], confidence_points: points };
      return next;
    });
  };

  const usedPoints = Object.values(picks)
    .map(p => p?.confidence_points)
    .filter((p): p is number => p !== undefined);

  const hasAnyPick = Object.values(picks).some(p => p?.predicted_winner);

  const handleSave = async () => {
    setSaving(true);
    try {
      const picksToSubmit: Pick[] = Object.entries(picks)
        .filter(([, p]) => p?.predicted_winner && p?.confidence_points)
        .map(([gameId, p]) => ({
          participant_id: participantId,
          pool_id: poolId,
          game_id: gameId,
          predicted_winner: p.predicted_winner!,
          confidence_points: p.confidence_points!,
          week: weekNumber,
          season_type: seasonType,
        }));

      if (picksToSubmit.length === 0) {
        toast({ title: 'No picks to save', description: 'Select a team and confidence points for at least one game.', variant: 'destructive' });
        return;
      }

      const result = await submitPicks(picksToSubmit);
      if (result.success) {
        toast({ title: 'Picks saved!', description: `${participantName}'s picks saved for Week ${weekNumber}.` });
        onPicksSubmitted?.();
      } else {
        toast({ title: 'Error saving picks', description: result.error, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (games.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', ...b, fontSize: '0.875rem', color: textDim }}>
        No games scheduled for Week {weekNumber}.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            pick={picks[game.id]}
            onSelectTeam={handleSelectTeam}
            onSetConfidence={handleSetConfidence}
            totalGames={games.length}
            usedPoints={usedPoints}
            locked={isLocked}
          />
        ))}
      </div>

      {!isLocked && (
        <button
          onClick={handleSave}
          disabled={saving || !hasAnyPick}
          style={{
            position: 'sticky',
            bottom: '1rem',
            width: '100%',
            padding: '1rem',
            borderRadius: 16,
            border: 'none',
            background: hasAnyPick && !saving ? green : 'oklch(26% 0.03 255)',
            color: '#fff',
            cursor: hasAnyPick && !saving ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: hasAnyPick && !saving ? `0 8px 24px ${green}40` : 'none',
            transition: 'background 0.2s ease, box-shadow 0.2s ease',
            ...bc,
            fontWeight: 800,
            fontSize: '1rem',
          }}
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save {participantName}&apos;s Picks
            </>
          )}
        </button>
      )}
    </div>
  );
}
