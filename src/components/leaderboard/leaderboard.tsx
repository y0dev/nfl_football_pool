'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, RefreshCw, BarChart3 } from 'lucide-react';
import { Game } from '@/types/game';
import { LeaderboardEntryWithPicks } from '@/actions/loadPicksForLeaderboard';
import { debugError, debugLog, getTeamAbbreviation, PERIOD_WEEKS, isDummyData } from '@/lib/utils';
import { getSupabaseServiceClient } from '@/lib/supabase';

// Design tokens
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface LeaderboardProps {
  poolId?: string;
  weekNumber?: number;
  seasonType?: number;
  season?: number;
}

export function Leaderboard({ poolId, weekNumber = 1, seasonType = 2, season }: LeaderboardProps) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntryWithPicks[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [mondayNightScores, setMondayNightScores] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Function to load Monday night scores for tie-breaker weeks
  const loadMondayNightScores = async (poolId: string, weekNumber: number, season: number) => {
    debugLog('loadMondayNightScores called with:', { poolId, weekNumber, season, PERIOD_WEEKS });
    if (isDummyData()) {
      return new Map();
    }

    if (!PERIOD_WEEKS.includes(weekNumber as typeof PERIOD_WEEKS[number])) {
      debugLog('Not a tie-breaker week, skipping Monday night scores');
      return new Map();
    }

    debugLog('Loading Monday night scores for tie-breaker week:', weekNumber);

    try {
      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase
        .from('tie_breakers')
        .select('participant_id, answer')
        .eq('pool_id', poolId)
        .eq('week', weekNumber)
        .eq('season', season);

      if (error) {
        debugError('Error loading Monday night scores:', error);
        return new Map();
      }

      debugLog('Monday night scores data:', data);

      const scoresMap = new Map<string, number>();
      data?.forEach(score => {
        scoresMap.set(score.participant_id, score.answer);
      });

      debugLog('Monday night scores map:', scoresMap);
      return scoresMap;
    } catch (err) {
      debugError('Error loading Monday night scores:', err);
      return new Map();
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!poolId) return;

      try {
        setIsLoading(true);
        debugLog('Loading leaderboard data for poolId:', poolId, 'week:', weekNumber, 'seasonType:', seasonType, 'season:', season);
        const response = await fetch(`/api/leaderboard?poolId=${poolId}&week=${weekNumber}&seasonType=${seasonType}${season ? `&season=${season}` : ''}`);

        if (!response.ok) {
          throw new Error('Failed to load leaderboard data');
        }

        const result = await response.json();
        debugLog('Leaderboard data loaded:', result);
        if (result.success) {
          setLeaderboardData(result.leaderboard);
          setGames(result.games);

          debugLog('About to load Monday night scores for:', { poolId, weekNumber, season: season || new Date().getFullYear() });
          const mondayNightScoresData = await loadMondayNightScores(poolId, weekNumber, season || new Date().getFullYear());
          debugLog('Monday night scores loaded:', mondayNightScoresData);
          setMondayNightScores(mondayNightScoresData);
        } else {
          throw new Error(result.error || 'Failed to load leaderboard data');
        }

      } catch (error) {
        debugError('Error loading leaderboard data:', error);
        setError('Failed to load leaderboard data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [poolId, weekNumber, seasonType, season]);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <RefreshCw style={{ width: 28, height: 28, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
        <p style={{ ...b, fontSize: '0.85rem', color: textMid }}>Loading leaderboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p style={{ ...b, fontSize: '0.875rem', color: liveRed }}>{error}</p>
      </div>
    );
  }

  if (leaderboardData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <BarChart3 style={{ width: 36, height: 36, color: textDim, margin: '0 auto 0.75rem' }} />
        <p style={{ ...b, fontSize: '0.875rem', color: textMid }}>No leaderboard data available for this week.</p>
      </div>
    );
  }

  debugLog('Leaderboard render - weekNumber:', weekNumber, 'PERIOD_WEEKS:', PERIOD_WEEKS, 'isPeriodWeek:', PERIOD_WEEKS.includes(weekNumber as typeof PERIOD_WEEKS[number]));
  debugLog('Monday night scores:', mondayNightScores);

  const isPeriodWeek = PERIOD_WEEKS.includes(weekNumber as typeof PERIOD_WEEKS[number]);

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <Table style={{ width: 'max-content', minWidth: '100%' }}>
        <TableHeader>
          <TableRow style={{ borderBottom: `1px solid ${border}`, background: surface }}>
            <TableHead style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', minWidth: '3.5rem', whiteSpace: 'nowrap' }}>
              Rank
            </TableHead>
            <TableHead style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', minWidth: '9rem', whiteSpace: 'nowrap' }}>
              Participant
            </TableHead>
            <TableHead style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', textAlign: 'center', minWidth: '4.5rem', whiteSpace: 'nowrap' }}>
              Points
            </TableHead>
            <TableHead style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', textAlign: 'center', minWidth: '5rem', whiteSpace: 'nowrap' }}>
              Correct
            </TableHead>
            {isPeriodWeek && (
              <TableHead style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', textAlign: 'center', minWidth: '5rem', whiteSpace: 'nowrap' }}>
                Mon Night
              </TableHead>
            )}
            {games.map((game, index) => (
              <TableHead key={game.id || index} style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.06em', color: textDim, textTransform: 'uppercase', textAlign: 'center', padding: '0.5rem 0.4rem', minWidth: '3.5rem', whiteSpace: 'nowrap' }}>
                <div>{getTeamAbbreviation(game.away_team || '')}</div>
                <div style={{ color: textDim, fontSize: '0.55rem' }}>@</div>
                <div>{getTeamAbbreviation(game.home_team || '')}</div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaderboardData.map((entry, index) => (
            <TableRow key={entry.participant_id || index} style={{ borderBottom: `1px solid ${border}`, background: index % 2 === 0 ? 'transparent' : 'oklch(18% 0.028 255 / 0.5)' }}>
              <TableCell style={{ ...b, fontSize: '0.875rem', color: text }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {index === 0 && <Trophy style={{ width: 13, height: 13, color: gold }} />}
                  {index === 1 && <Trophy style={{ width: 13, height: 13, color: textMid }} />}
                  {index === 2 && <Trophy style={{ width: 13, height: 13, color: amber }} />}
                  <span style={{ color: index < 3 ? text : textMid, fontWeight: index < 3 ? 700 : 400 }}>{index + 1}</span>
                </div>
              </TableCell>
              <TableCell style={{ ...b, fontSize: '0.875rem', color: text, fontWeight: 600, maxWidth: '14rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.participant_name || 'Unknown'}
              </TableCell>
              <TableCell style={{ ...bc, fontSize: '0.95rem', fontWeight: 900, color: greenHi, textAlign: 'center' }}>
                {entry.total_points || 0}
              </TableCell>
              <TableCell style={{ ...b, fontSize: '0.875rem', color: textMid, textAlign: 'center' }}>
                {entry.correct_picks || 0}/{entry.total_picks || 0}
              </TableCell>
              {isPeriodWeek && (
                <TableCell style={{ ...b, fontSize: '0.875rem', color: textMid, textAlign: 'center' }}>
                  {(() => {
                    const score = mondayNightScores.get(entry.participant_id);
                    debugLog(`Monday night score for ${entry.participant_name} (${entry.participant_id}):`, score);
                    return score || '-';
                  })()}
                </TableCell>
              )}
              {games.map((game, gameIndex) => {
                const status = game.status?.toLowerCase() || '';
                const pick = entry.picks?.find(p => p.game_id === game.id);
                const isGameFinal = status === 'final' || status === 'post';
                const isGameInProgress = status === 'live' || status === 'in progress' || status === 'in_progress' || status === 'halftime';
                const isCorrect = pick && isGameFinal && game.winner?.toLowerCase() && pick.predicted_winner?.toLowerCase() === game.winner?.toLowerCase();
                const confidence = pick?.confidence_points || 0;

                // Pick color
                const pickColor = isGameInProgress
                  ? 'oklch(65% 0.12 240)'
                  : !isGameFinal
                  ? amber
                  : isCorrect
                  ? greenHi
                  : liveRed;

                // Badge background
                const badgeBg = confidence === 0
                  ? 'oklch(26% 0.03 255)'
                  : isGameInProgress
                  ? 'oklch(65% 0.12 240 / 0.2)'
                  : !isGameFinal
                  ? `${amber}22`
                  : isCorrect
                  ? 'oklch(46% 0.14 155 / 0.2)'
                  : `${liveRed}22`;

                return (
                  <TableCell key={game.id || gameIndex} style={{ textAlign: 'center', padding: '0.35rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                      <div style={{ ...b, fontSize: '0.75rem', fontWeight: 600, color: pickColor }}>
                        {pick?.predicted_winner ? getTeamAbbreviation(pick.predicted_winner) : '-'}
                      </div>
                      <div style={{
                        ...bc, fontSize: '0.7rem', fontWeight: 700,
                        padding: '0.1rem 0.3rem', borderRadius: 3,
                        minWidth: '1.4rem', textAlign: 'center',
                        background: badgeBg, color: pickColor,
                      }}>
                        {confidence}
                      </div>
                      {pick && pick.home_score !== null && pick.away_score !== null && (
                        <div style={{ ...b, fontSize: '0.65rem', color: textDim }}>
                          {pick.away_score}-{pick.home_score}
                        </div>
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
