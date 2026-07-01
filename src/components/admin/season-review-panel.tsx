'use client';

import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Target, TrendingUp, Users, Calendar, BarChart3, RefreshCw } from 'lucide-react';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';
const purple  = 'oklch(65% 0.12 290)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface SeasonReviewData {
  seasonWinner: any;
  quarterlyWinners: any[];
  weeklyWinners: any[];
  participantStats: {
    participant_id: string;
    name: string;
    total_points: number;
    total_correct_picks: number;
    total_picks: number;
    weeks_won: number;
    best_week: { week: number; points: number; correct_picks: number };
    worst_week: { week: number; points: number; correct_picks: number };
    average_points_per_week: number;
    consistency_score: number;
  }[];
  seasonStats: {
    total_weeks: number;
    total_participants: number;
    total_games: number;
    average_points_per_week: number;
    highest_weekly_score: number;
    lowest_weekly_score: number;
    tie_breakers_used: number;
    most_wins_by_participant: string;
    most_wins_count: number;
    closest_weekly_margin: number;
    biggest_weekly_blowout: number;
  };
}

interface SeasonReviewPanelProps {
  poolId: string;
  season: number;
}

export function SeasonReviewPanel({ poolId, season }: SeasonReviewPanelProps) {
  const [data, setData] = useState<SeasonReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'winners' | 'participants' | 'weekly'>('overview');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/season-review?poolId=${poolId}&season=${season}`);
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load season data');
        }
      } catch {
        setError('Failed to load season data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [poolId, season]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <RefreshCw style={{ width: 24, height: 24, color: textDim, margin: '0 auto 0.5rem', animation: 'spin 1s linear infinite' }} />
        <p style={{ ...b, color: textMid, fontSize: '0.85rem' }}>Loading season review…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
        <Trophy style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: text, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Season Review</p>
        <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>{error || 'No season data available yet'}</p>
      </div>
    );
  }

  const { seasonWinner, quarterlyWinners, weeklyWinners, participantStats, seasonStats } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Season Stats row */}
      <div className="admin-stats-grid">
        {[
          { icon: Calendar, label: 'Weeks', value: seasonStats.total_weeks },
          { icon: Users, label: 'Participants', value: seasonStats.total_participants },
          { icon: Target, label: 'Games', value: seasonStats.total_games },
          { icon: BarChart3, label: 'Avg Pts/Week', value: seasonStats.average_points_per_week },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Icon style={{ width: 18, height: 18, color: textDim, flexShrink: 0 }} />
            <div>
              <p style={{ ...bc, fontWeight: 900, fontSize: '1.3rem', color: greenHi, lineHeight: 1 }}>{value}</p>
              <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '0.25rem', display: 'flex', gap: '0.15rem' }}>
        {(['overview', 'winners', 'participants', 'weekly'] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase',
                padding: '0.45rem 0.5rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: active ? card : 'transparent',
                color: active ? text : textMid,
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {seasonWinner && (
            <div style={{ background: card, border: `1px solid oklch(74% 0.16 72 / 0.35)`, borderTop: `3px solid ${gold}`, borderRadius: 10, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <Trophy style={{ width: 18, height: 18, color: gold }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em', color: gold, textTransform: 'uppercase' }}>Season Champion</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <p style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', color: text, lineHeight: 1.1 }}>{seasonWinner.winner_name}</p>
                  <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginTop: '0.3rem' }}>
                    {seasonWinner.total_points} points &bull; {seasonWinner.weeks_won} weeks won
                  </p>
                  {seasonWinner.tie_breaker_used && (
                    <span style={{ display: 'inline-block', marginTop: '0.5rem', ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em', padding: '0.15rem 0.45rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(65% 0.12 290 / 0.15)', color: purple, border: `1px solid oklch(65% 0.12 290 / 0.35)` }}>Won via tie-breaker</span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ ...b, fontSize: '0.75rem', color: textDim }}>Correct Picks</p>
                  <p style={{ ...bc, fontWeight: 900, fontSize: '1.3rem', color: greenHi }}>
                    {seasonWinner.total_correct_picks}/{seasonWinner.total_participants * seasonStats.total_weeks}
                  </p>
                </div>
              </div>
            </div>
          )}

          {quarterlyWinners.length > 0 && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <Medal style={{ width: 16, height: 16, color: amber }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase' }}>Quarterly Champions</p>
              </div>
              <div className="admin-stats-grid">
                {quarterlyWinners.map((quarter) => (
                  <div key={quarter.period_name} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem', textAlign: 'center' }}>
                    <p style={{ ...bc, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem' }}>{quarter.period_name}</p>
                    <p style={{ ...bc, fontWeight: 900, fontSize: '1rem', color: greenHi }}>{quarter.winner_name}</p>
                    <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>{quarter.period_points} points</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <Award style={{ width: 16, height: 16, color: greenHi }} />
              <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase' }}>Season Highlights</p>
            </div>
            <div className="admin-2col-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  { label: 'Highest Weekly Score', value: `${seasonStats.highest_weekly_score} points` },
                  { label: 'Most Weekly Wins', value: `${seasonStats.most_wins_by_participant} (${seasonStats.most_wins_count} wins)` },
                  { label: 'Closest Weekly Margin', value: `${seasonStats.closest_weekly_margin} points` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: `1px solid ${border}` }}>
                    <span style={{ ...b, fontSize: '0.8rem', color: textMid }}>{label}</span>
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: text }}>{value}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  { label: 'Tie-breakers Used', value: `${seasonStats.tie_breakers_used} weeks` },
                  { label: 'Lowest Weekly Score', value: `${seasonStats.lowest_weekly_score} points` },
                  { label: 'Biggest Weekly Blowout', value: `${seasonStats.biggest_weekly_blowout} points` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: `1px solid ${border}` }}>
                    <span style={{ ...b, fontSize: '0.8rem', color: textMid }}>{label}</span>
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: text }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {participantStats.length > 0 && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <Trophy style={{ width: 16, height: 16, color: purple }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase' }}>Special Awards</p>
              </div>
              <div className="admin-2col-grid">
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem', textAlign: 'center' }}>
                  <p style={{ ...bc, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.07em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Most Consistent</p>
                  <p style={{ ...bc, fontWeight: 900, fontSize: '1.1rem', color: text }}>
                    {participantStats.reduce((best, cur) => cur.consistency_score < best.consistency_score ? cur : best).name}
                  </p>
                  <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>
                    Score: {Math.min(...participantStats.map(p => p.consistency_score))}
                  </p>
                </div>
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem', textAlign: 'center' }}>
                  <p style={{ ...bc, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.07em', color: amber, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Highest Average</p>
                  <p style={{ ...bc, fontWeight: 900, fontSize: '1.1rem', color: text }}>
                    {participantStats.reduce((best, cur) => cur.average_points_per_week > best.average_points_per_week ? cur : best).name}
                  </p>
                  <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>
                    {Math.max(...participantStats.map(p => p.average_points_per_week))} pts/week
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Winners */}
      {activeTab === 'winners' && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase', marginBottom: '0.35rem' }}>Weekly Winners</p>
          <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1rem' }}>All weekly champions for the {season} season</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {weeklyWinners.map((winner) => (
              <div key={winner.week} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', padding: '0.85rem 1rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', padding: '0.2rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>Week {winner.week}</span>
                  <div>
                    <p style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{winner.winner_name}</p>
                    <p style={{ ...b, fontSize: '0.75rem', color: textDim }}>{winner.winner_points} points &bull; {winner.winner_correct_picks} correct</p>
                  </div>
                </div>
                {winner.tie_breaker_used && (
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em', padding: '0.15rem 0.45rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(65% 0.12 290 / 0.15)', color: purple, border: `1px solid oklch(65% 0.12 290 / 0.35)` }}>Tie-breaker</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Participants */}
      {activeTab === 'participants' && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase', marginBottom: '0.35rem' }}>Participant Statistics</p>
          <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1rem' }}>Detailed stats for all participants</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {participantStats.map((participant, index) => (
              <div key={participant.participant_id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ ...bc, fontWeight: 800, fontSize: '0.8rem', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: index < 3 ? 'oklch(74% 0.16 72 / 0.15)' : 'oklch(26% 0.03 255)', color: index < 3 ? gold : textDim, border: `1px solid ${index < 3 ? 'oklch(74% 0.16 72 / 0.35)' : border}`, flexShrink: 0 }}>#{index + 1}</span>
                    <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text }}>{participant.name}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ ...bc, fontWeight: 900, fontSize: '1.25rem', color: greenHi, lineHeight: 1 }}>{participant.total_points} pts</p>
                    <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>{participant.weeks_won} weeks won</p>
                  </div>
                </div>
                <div className="admin-stats-grid">
                  {[
                    { label: 'Best Week', value: `Wk ${participant.best_week.week}: ${participant.best_week.points} pts` },
                    { label: 'Worst Week', value: `Wk ${participant.worst_week.week}: ${participant.worst_week.points} pts` },
                    { label: 'Avg Pts/Week', value: String(participant.average_points_per_week) },
                    { label: 'Consistency', value: String(participant.consistency_score) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>{label}</p>
                      <p style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: textMid, marginTop: '0.15rem' }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly */}
      {activeTab === 'weekly' && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em', color: text, textTransform: 'uppercase', marginBottom: '0.35rem' }}>Weekly Breakdown</p>
          <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1rem' }}>Week-by-week performance</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {weeklyWinners.map((winner) => (
              <div key={winner.week} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <p style={{ ...bc, fontWeight: 800, fontSize: '0.88rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Week {winner.week}</p>
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.07em', padding: '0.15rem 0.45rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textDim, border: `1px solid ${border}` }}>{winner.total_participants} participants</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <p style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{winner.winner_name}</p>
                    <p style={{ ...b, fontSize: '0.75rem', color: textDim }}>{winner.winner_points} points &bull; {winner.winner_correct_picks} correct</p>
                  </div>
                  {winner.tie_breaker_used && (
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em', padding: '0.15rem 0.45rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(65% 0.12 290 / 0.15)', color: purple, border: `1px solid oklch(65% 0.12 290 / 0.35)` }}>Tie-breaker used</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
