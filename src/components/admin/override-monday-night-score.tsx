'use client';

import { useState, useEffect, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Users, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE } from '@/lib/utils';
import { getMondayNightGameInfo } from '@/lib/monday-night-utils';
import { Game } from '@/types/game';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const blue    = 'oklch(65% 0.15 250)';
const amber   = 'oklch(72% 0.16 60)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const cardStyle = { background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' };
const labelStyle = { ...bc, fontSize: '0.68rem', fontWeight: 700 as const, color: textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' };
const inputStyle = { ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box' as const, fontSize: '0.875rem' };

interface Participant {
  id: string;
  name: string;
  email?: string;
  poolId?: string;
  poolName?: string;
}

interface OverrideMondayNightScoreProps {
  poolId?: string;
  poolName: string;
  week: number;
  season: number;
  seasonType: number;
}

export function OverrideMondayNightScore({ poolId, poolName, week, season, seasonType }: OverrideMondayNightScoreProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  const [mondayNightScore, setMondayNightScore] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [mondayNightGameInfo, setMondayNightGameInfo] = useState<{ game: Game; displayText: string } | null>(null);
  const { toast } = useToast();

  const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
  const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE;
  const shouldShowOverride = isPeriodWeek || isSuperBowl;

  const loadParticipants = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!poolId) {
        toast({ title: 'Error', description: 'Pool ID is required to load participants', variant: 'destructive' });
        return;
      }
      const { data, error } = await supabase
        .from('participants')
        .select('id, name, email')
        .eq('pool_id', poolId)
        .eq('is_active', true)
        .order('name');
      if (error) {
        toast({ title: 'Error', description: 'Failed to load participants', variant: 'destructive' });
        return;
      }
      setParticipants((data || []).map(p => ({ id: p.id, name: p.name, email: p.email, poolId, poolName })));
    } catch (error) {
      console.error('Error loading participants:', error);
      toast({ title: 'Error', description: 'Failed to load participants', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [poolId, poolName, toast]);

  const loadGames = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/week?week=${week}&seasonType=${seasonType}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setGames(result.games);
          setMondayNightGameInfo(getMondayNightGameInfo(result.games));
        }
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  }, [week, seasonType]);

  useEffect(() => {
    if (shouldShowOverride && poolId) {
      loadParticipants();
      loadGames();
    }
  }, [shouldShowOverride, poolId, loadParticipants, loadGames]);

  const handleSubmit = async () => {
    if (!selectedParticipant || !mondayNightScore) {
      toast({ title: 'Error', description: 'Please select a participant and enter a Monday night score', variant: 'destructive' });
      return;
    }
    const score = parseInt(mondayNightScore);
    if (isNaN(score) || score < 0) {
      toast({ title: 'Error', description: 'Monday night score must be a positive number', variant: 'destructive' });
      return;
    }
    const participant = participants.find(p => p.id === selectedParticipant);
    const targetPoolId = poolId || participant?.poolId;
    if (!targetPoolId) {
      toast({ title: 'Error', description: 'Could not determine pool for selected participant', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/override-monday-night-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: targetPoolId, participantId: selectedParticipant, week, season, seasonType, mondayNightScore: score }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message });
        setSelectedParticipant('');
        setMondayNightScore('');
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error submitting Monday night score:', error);
      toast({ title: 'Error', description: 'Failed to submit Monday night score', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!shouldShowOverride) return null;

  const submitDisabled = !selectedParticipant || !mondayNightScore || isSubmitting;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
        <Target style={{ width: 14, height: 14, color: blue }} />
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Override Monday Night Score</p>
      </div>
      <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>
        Add Monday night game score predictions for participants in this pool.
        {isPeriodWeek && ` This week (${PERIOD_WEEKS.join(', ')}) serves as a tie-breaker.`}
        {isSuperBowl && ' This is the Super Bowl where tie breakers are used.'}
      </p>

      {/* Game Info */}
      {mondayNightGameInfo ? (
        <div style={{ padding: '0.75rem 0.85rem', background: `color-mix(in oklch, ${blue} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${blue} 25%, ${border})`, borderRadius: 6, marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
            <Target style={{ width: 13, height: 13, color: blue }} />
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: blue, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monday Night Game</span>
          </div>
          <p style={{ ...b, fontWeight: 700, fontSize: '0.9rem', color: text }}>{mondayNightGameInfo.displayText}</p>
          <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>
            Game ID: {mondayNightGameInfo.game.id} | Kickoff: {new Date(mondayNightGameInfo.game.kickoff_time).toLocaleString()}
          </p>
        </div>
      ) : (
        <div style={{ padding: '0.75rem 0.85rem', background: `color-mix(in oklch, ${amber} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${amber} 25%, ${border})`, borderRadius: 6, marginBottom: '0.85rem' }}>
          <p style={{ ...b, fontSize: '0.78rem', color: amber }}>No Monday night game found for Week {week}. Please check the games data.</p>
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem' }}>
          <Loader2 style={{ width: 20, height: 20, color: textDim, animation: 'spin 0.8s linear infinite' }} />
          <span style={{ ...b, fontSize: '0.8rem', color: textDim }}>Loading participants...</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div>
              <label style={labelStyle}>Participant</label>
              <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
                <SelectTrigger><SelectValue placeholder="Select a participant" /></SelectTrigger>
                <SelectContent>
                  {participants.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span>{p.name}</span>
                      {p.email && <span style={{ color: textDim, fontSize: '0.75em', marginLeft: '0.35rem' }}>({p.email})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label style={labelStyle}>Monday Night Score</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 45"
                value={mondayNightScore}
                onChange={(e) => setMondayNightScore(e.target.value)}
                style={inputStyle}
              />
              <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>Total points predicted for Monday night game</p>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitDisabled}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', background: submitDisabled ? border : green, color: submitDisabled ? textDim : text, border: 'none', borderRadius: 6, cursor: submitDisabled ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            {isSubmitting ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: 13, height: 13 }} />}
            {isSubmitting ? 'Adding Score...' : 'Add Monday Night Score'}
          </button>

          {participants.length === 0 && (
            <div style={{ marginTop: '0.85rem', padding: '0.75rem 1rem', background: surface, border: `1px solid ${border}`, borderRadius: 6 }}>
              <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>No participants found with submitted picks for this week.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
