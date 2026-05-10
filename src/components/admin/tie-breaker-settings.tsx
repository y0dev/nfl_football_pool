'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Save, RefreshCw, Loader2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getTieBreakerSettings, saveTieBreakerSettings, TieBreakerSettings as TieBreakerSettingsType } from '@/lib/tie-breakers';
import { PERIOD_WEEKS } from '@/lib/utils';
import { getMondayNightGameInfo } from '@/lib/monday-night-utils';
import { Game } from '@/types/game';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
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

interface TieBreakerSettingsProps {
  poolId: string;
  poolName: string;
}

const DEFAULT_TIE_BREAKERS = [
  { id: 'total_points', name: 'Total Points (All Weeks)', description: 'Break ties by total points across all weeks' },
  { id: 'correct_picks', name: 'Most Correct Picks', description: 'Break ties by total correct picks across all weeks' },
  { id: 'accuracy', name: 'Pick Accuracy', description: 'Break ties by percentage of correct picks' },
  { id: 'last_week', name: 'Last Week Performance', description: 'Break ties by points in the most recent week' },
  { id: 'monday_night_total', name: 'Monday Night Game Total', description: 'Break ties by closest prediction to Monday night game total score' },
  { id: 'custom', name: 'Custom Question', description: 'Use a custom tie-breaker question' },
];

export function TieBreakerSettings({ poolId, poolName }: TieBreakerSettingsProps) {
  const [settings, setSettings] = useState<TieBreakerSettingsType>({
    method: 'total_points',
    question: null,
    answer: null,
    monday_night_game_id: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [mondayNightGameInfo, setMondayNightGameInfo] = useState<{ game: Game; displayText: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => { loadTieBreakerSettings(); }, [poolId]);
  useEffect(() => { if (settings.method === 'monday_night_total') loadGames(); }, [settings.method]);

  const loadTieBreakerSettings = async () => {
    setIsLoading(true);
    try {
      const s = await getTieBreakerSettings(poolId);
      setSettings(s || { method: 'total_points', question: null, answer: null });
    } catch {
      toast({ title: 'Error', description: 'Failed to load tie-breaker settings', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadGames = async () => {
    try {
      const response = await fetch('/api/games/week?week=1&seasonType=2');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setGames(result.games);
          const info = getMondayNightGameInfo(result.games);
          setMondayNightGameInfo(info);
          if (info && !settings.monday_night_game_id) {
            setSettings(prev => ({ ...prev, monday_night_game_id: info.game.id }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await saveTieBreakerSettings(poolId, settings);
      if (success) toast({ title: 'Success', description: 'Tie-breaker settings saved successfully' });
      else throw new Error('Failed to save settings');
    } catch {
      toast({ title: 'Error', description: 'Failed to save tie-breaker settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMethodChange = (method: string) => {
    setSettings(prev => ({
      ...prev,
      method,
      question: method === 'custom' ? prev.question : null,
      answer: method === 'custom' ? prev.answer : null,
    }));
  };

  const getMethodDescription = (methodId: string) => DEFAULT_TIE_BREAKERS.find(m => m.id === methodId)?.description || '';

  const saveDisabled = isSaving || (settings.method === 'custom' && (!settings.question || settings.answer === null));

  if (isLoading) {
    return (
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <Loader2 style={{ width: 28, height: 28, color: textDim, animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
        <Settings style={{ width: 14, height: 14, color: textMid }} />
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tie-Breaker Settings</p>
      </div>
      <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1.25rem' }}>Configure how ties are broken in {poolName}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Method Selection */}
        <div>
          <label style={labelStyle}>Tie-Breaker Method</label>
          <Select value={settings.method} onValueChange={handleMethodChange}>
            <SelectTrigger><SelectValue placeholder="Select tie-breaker method" /></SelectTrigger>
            <SelectContent>
              {DEFAULT_TIE_BREAKERS.map(method => (
                <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {settings.method && (
            <div style={{ marginTop: '0.6rem', padding: '0.65rem 0.85rem', background: `color-mix(in oklch, ${blue} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${blue} 25%, ${border})`, borderRadius: 6 }}>
              <p style={{ ...b, fontSize: '0.78rem', color: textMid }}>
                <span style={{ fontWeight: 700 }}>How it works:</span> {getMethodDescription(settings.method)}
              </p>
            </div>
          )}
        </div>

        {/* Custom Question */}
        {settings.method === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Custom Tie-Breaker Question</label>
              <Textarea
                placeholder="e.g., What will be the total combined score of all games this week?"
                value={settings.question || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, question: e.target.value }))}
                style={{ ...inputStyle, resize: 'vertical' as const, marginTop: '0.25rem' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Correct Answer</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g., 245.5"
                value={settings.answer || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, answer: parseFloat(e.target.value) || null }))}
                style={{ ...inputStyle, marginTop: '0.25rem' }}
              />
              <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>
                This is the answer used to determine the winner in case of a tie.
              </p>
            </div>
          </div>
        )}

        {/* Monday Night Total */}
        {settings.method === 'monday_night_total' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {mondayNightGameInfo ? (
              <div style={{ padding: '0.75rem 0.85rem', background: `color-mix(in oklch, ${blue} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${blue} 25%, ${border})`, borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                  <Settings style={{ width: 13, height: 13, color: blue }} />
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: blue, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Selected Monday Night Game</span>
                </div>
                <p style={{ ...b, fontWeight: 700, fontSize: '0.9rem', color: text }}>{mondayNightGameInfo.displayText}</p>
                <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>
                  Game ID: {mondayNightGameInfo.game.id} | Kickoff: {new Date(mondayNightGameInfo.game.kickoff_time).toLocaleString()}
                </p>
              </div>
            ) : (
              <div style={{ padding: '0.75rem 0.85rem', background: `color-mix(in oklch, ${amber} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${amber} 25%, ${border})`, borderRadius: 6 }}>
                <p style={{ ...b, fontSize: '0.78rem', color: amber }}>No Monday night game found for the current week. Please check the games data.</p>
              </div>
            )}
            <div>
              <label style={labelStyle}>Monday Night Game Total Score</label>
              <input
                type="number"
                step="1"
                placeholder="e.g., 45"
                value={settings.answer || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, answer: parseInt(e.target.value) || null }))}
                style={{ ...inputStyle, marginTop: '0.25rem' }}
              />
              <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>
                Enter the actual total points scored in the Monday night game.
              </p>
            </div>
          </div>
        )}

        {/* Preview */}
        <div style={{ padding: '0.85rem 1rem', background: surface, border: `1px solid ${border}`, borderRadius: 6 }}>
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', color: textMid, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>Tie-Breaker Preview</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...b, fontSize: '0.8rem', color: textDim }}>Method:</span>
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: greenHi, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.15rem 0.5rem', background: `color-mix(in oklch, ${greenHi} 10%, ${surface})`, border: `1px solid color-mix(in oklch, ${greenHi} 25%, ${border})`, borderRadius: 4 }}>
                {DEFAULT_TIE_BREAKERS.find(m => m.id === settings.method)?.name}
              </span>
            </div>
            {settings.method === 'custom' && settings.question && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <span style={{ ...b, fontSize: '0.8rem', color: textDim }}>Question:</span>
                <span style={{ ...b, fontSize: '0.78rem', color: textMid, textAlign: 'right', maxWidth: '60%' }}>{settings.question}</span>
              </div>
            )}
            {settings.method === 'custom' && settings.answer !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ ...b, fontSize: '0.8rem', color: textDim }}>Answer:</span>
                <span style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: text }}>{settings.answer}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={loadTieBreakerSettings}
            disabled={isSaving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.85rem', background: 'transparent', color: isSaving ? textDim : textMid, border: `1px solid ${border}`, borderRadius: 6, cursor: isSaving ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            <RefreshCw style={{ width: 12, height: 12 }} />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saveDisabled}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', background: saveDisabled ? border : green, color: saveDisabled ? textDim : text, border: 'none', borderRadius: 6, cursor: saveDisabled ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            {isSaving ? <Loader2 style={{ width: 12, height: 12, animation: 'spin 0.8s linear infinite' }} /> : <Save style={{ width: 12, height: 12 }} />}
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Help */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <p style={{ ...b, fontSize: '0.72rem', color: textDim }}><strong>Note:</strong> Tie-breaker settings apply to all weeks in the pool.</p>
          <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>For normal pools, tie-breakers are only used during tie-breaker weeks ({PERIOD_WEEKS.join(', ')}) and the Super Bowl.</p>
          <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>For custom questions, participants will be asked to provide their answer when submitting picks.</p>
        </div>
      </div>
    </div>
  );
}
