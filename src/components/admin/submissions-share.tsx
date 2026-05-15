'use client';

import { useState, useEffect } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { getWeeklySubmissionsForScreenshot } from '@/actions/adminActions';
import { useToast } from '@/hooks/use-toast';
import { Game, Participant } from '@/types/game';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const purple  = 'oklch(65% 0.12 290)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface SubmissionsShareProps {
  poolId: string;
  poolName: string;
  week: number;
  seasonType?: number;
}

export function SubmissionsShare({ poolId, poolName, week, seasonType }: SubmissionsShareProps) {
  const [submissionsData, setSubmissionsData] = useState<{ games: Game[]; participants: Participant[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadSubmissionsData(); }, [poolId, week, seasonType]);

  const loadSubmissionsData = async () => {
    setIsLoading(true);
    try {
      let weekToUse = week;
      let seasonTypeToUse = seasonType;
      if (!weekToUse || !seasonTypeToUse) {
        const { getCurrentWeekFromGames } = await import('@/actions/getCurrentWeekFromGames');
        const currentWeekData = await getCurrentWeekFromGames();
        weekToUse = weekToUse || currentWeekData.week;
        seasonTypeToUse = seasonTypeToUse || currentWeekData.seasonType;
      }
      const data = await getWeeklySubmissionsForScreenshot(poolId, weekToUse, seasonTypeToUse);
      setSubmissionsData(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load submissions data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const shareToText = () => {
    if (!submissionsData) return;
    let textContent = `${poolName} - Week ${week} Submissions\n\n`;
    submissionsData.participants.forEach((participant) => {
      textContent += `${participant.name}:\n`;
      submissionsData.games.forEach((game) => {
        const pick = participant.picks?.get(game.id);
        if (pick) {
          const result = getGameResult(game, pick.predicted_winner);
          const icon = result === 'win' ? '✅' : result === 'loss' ? '❌' : '⏳';
          textContent += `  ${game.away_team} @ ${game.home_team}: ${pick.predicted_winner} (${pick.confidence_points} pts) ${icon}\n`;
        } else {
          textContent += `  ${game.away_team} @ ${game.home_team}: Not submitted\n`;
        }
      });
      textContent += '\n';
    });
    navigator.clipboard.writeText(textContent).then(() => {
      toast({ title: 'Success', description: 'Submissions copied to clipboard!' });
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = textContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast({ title: 'Success', description: 'Submissions copied to clipboard!' });
    });
  };

  const getGameResult = (game: Game, predictedWinner: string): 'win' | 'loss' | 'pending' => {
    if (!game.winner || game.status !== 'finished') return 'pending';
    return predictedWinner === game.winner ? 'win' : 'loss';
  };

  const cardStyle = { background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' };

  if (isLoading) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <Loader2 style={{ width: 24, height: 24, color: textDim, animation: 'spin 0.8s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (!submissionsData) {
    return (
      <div style={cardStyle}>
        <p style={{ ...b, fontSize: '0.8rem', color: textDim, textAlign: 'center', padding: '1.5rem 0' }}>No submissions data available for this week</p>
      </div>
    );
  }

  const withSubmissions = submissionsData.participants.filter(p => submissionsData.games.some(g => p.picks?.has(g.id))).length;
  const completionRate = submissionsData.participants.length > 0 ? Math.round((withSubmissions / submissionsData.participants.length) * 100) : 0;

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
            <Share2 style={{ width: 15, height: 15, color: textMid }} />
            <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Week {week} Submissions</p>
          </div>
          <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>Copy submissions for sharing in text format</p>
        </div>
        <button
          onClick={shareToText}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', background: green, color: text, border: 'none', borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          <Share2 style={{ width: 12, height: 12 }} />
          Copy for Text
        </button>
      </div>

      {/* Stats */}
      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem' }}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: '0.75rem' }}>{poolName} — Week {week}</p>
        <p style={{ ...b, fontSize: '0.75rem', color: textDim, textAlign: 'center', marginBottom: '0.85rem' }}>
          {submissionsData.participants.length} participants &bull; {submissionsData.games.length} games
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { label: 'Participants with submissions', value: `${withSubmissions} / ${submissionsData.participants.length}`, color: greenHi },
            { label: 'Games this week', value: String(submissionsData.games.length), color: greenHi },
            { label: 'Submission status', value: `${completionRate}% complete`, color: purple },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...b, fontSize: '0.8rem', color: textMid }}>{label}</span>
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '0.85rem', padding: '0.6rem', background: card, border: `1px solid ${border}`, borderRadius: 6 }}>
          <p style={{ ...b, fontSize: '0.72rem', color: textDim, textAlign: 'center' }}>
            Click &quot;Copy for Text&quot; to get a formatted list you can share in group chats.
          </p>
        </div>
      </div>
    </div>
  );
}
