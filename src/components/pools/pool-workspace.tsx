'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trophy, Users, TrendingUp, Edit, Calendar, BarChart3, Download, Settings,
  Link2, Check, AlertTriangle,
} from 'lucide-react';
import { ParticipantManagement } from '@/components/admin/participant-management';
import { OverridePicksPanel } from '@/components/admin/override-picks-panel';
import { SeasonReviewPanel } from '@/components/admin/season-review-panel';
import { PlayoffParticipantsList } from '@/components/admin/playoff-participants-list';
import { PoolSettings } from '@/components/admin/pool-settings';
import { ExportData } from '@/components/admin/export-data';
import { debugError } from '@/lib/utils';

// Design tokens (matches app-wide dark theme)
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

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

type PoolTab = 'overview' | 'players' | 'leaderboard' | 'override-picks' | 'season-review' | 'playoffs' | 'export' | 'settings';

interface PoolWorkspaceProps {
  poolId: string;
  poolName: string;
  season: number;
  seasonScope?: number[];
  currentWeek: number;
  currentSeasonType: number;
  /** Admin dashboard keeps its own separate system-wide export card, so it opts out of the per-pool one. Defaults to shown. */
  showExportTab?: boolean;
  /** Shows an Active/Inactive status pill next to Picks Page when provided (used by the system-wide admin view). */
  isActive?: boolean;
  onPoolDeleted?: () => void;
}

export function PoolWorkspace({
  poolId, poolName, season, seasonScope, currentWeek, currentSeasonType,
  showExportTab = true, isActive, onPoolDeleted,
}: PoolWorkspaceProps) {
  const router = useRouter();

  const [activePoolTab, setActivePoolTab] = useState<PoolTab>('overview');
  const [selectedPoolStats, setSelectedPoolStats] = useState({ participants: 0, completed: 0, pending: 0, completionRate: 0 });
  const [poolLeader, setPoolLeader] = useState<{ name: string; points: number; correctPicks: number } | null>(null);
  const [missingParticipants, setMissingParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [weekGamesCount, setWeekGamesCount] = useState(0);
  const [leaderboardEntries, setLeaderboardEntries] = useState<Array<{ participantId: string; name: string; points: number; correctPicks: number }>>([]);
  // Separate from leaderboardEntries.length === 0 — that's ambiguous between
  // "genuinely nobody has scored yet" and "the fetch failed/threw," which
  // previously rendered the identical "No scores recorded yet" message
  // either way and hid real failures as if they were normal empty state.
  const [leaderboardStatus, setLeaderboardStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [linkCopied, setLinkCopied] = useState(false);
  // Distinct from "no games this week" — this tracks whether the pick
  // window has opened yet at all, so Missing Picks doesn't get shown (and
  // participants flagged as delinquent) for a week that's simply too early.
  const [pickWindowOpened, setPickWindowOpened] = useState<boolean | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();

      const [{ data: allParticipants }, { data: weekGames }] = await Promise.all([
        supabase.from('participants').select('id, name').eq('pool_id', poolId).eq('is_active', true),
        supabase.from('games').select('id').eq('week', currentWeek).eq('season_type', currentSeasonType),
      ]);

      const total = allParticipants?.length ?? 0;
      const gameIds = weekGames?.map(g => g.id) ?? [];
      setWeekGamesCount(gameIds.length);

      const { hasWeekPickWindowOpened } = await import('@/actions/loadCurrentWeek');
      setPickWindowOpened(await hasWeekPickWindowOpened(currentWeek, currentSeasonType, season));

      let submittedIds = new Set<string>();
      if (gameIds.length > 0) {
        const { data: picks } = await supabase
          .from('picks')
          .select('participant_id')
          .eq('pool_id', poolId)
          .in('game_id', gameIds);
        submittedIds = new Set((picks ?? []).map(p => p.participant_id));
      }

      const completed = submittedIds.size;
      const pending = Math.max(0, total - completed);
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      setSelectedPoolStats({ participants: total, completed, pending, completionRate });

      setMissingParticipants((allParticipants ?? []).filter(p => !submittedIds.has(p.id)));

      // Season standings compute live from picks+games (the same source the
      // public leaderboard uses) rather than reading `scores` directly —
      // that table is only ever populated by an on-demand self-heal
      // triggered elsewhere and can't be assumed populated here. Pinned to
      // the pool's own latest regular-season week/season_type (not the
      // currentWeek/currentSeasonType props, which track Overview's
      // pick-tracking week and may be a different season_type once a pool
      // has moved into playoffs).
      const { getLatestWeekForSeason } = await import('@/actions/loadCurrentWeek');
      const latestRegular = await getLatestWeekForSeason(season, poolId, 2);
      const seasonRes = await fetch(`/api/leaderboard/season?poolId=${poolId}&season=${season}&currentWeek=${latestRegular.week}&currentSeasonType=2`);
      const seasonData = await seasonRes.json();

      if (!seasonRes.ok || !seasonData.success) {
        debugError('Season leaderboard fetch failed:', seasonData.error || seasonRes.statusText);
        setLeaderboardStatus('error');
        setPoolLeader(null);
        setLeaderboardEntries([]);
      } else {
        const ranked = (seasonData.leaderboard ?? []).map((entry: { participant_id: string; participant_name: string; total_points: number; total_correct_picks: number }) => ({
          participantId: entry.participant_id,
          name: entry.participant_name,
          points: entry.total_points,
          correctPicks: entry.total_correct_picks,
        }));
        setLeaderboardEntries(ranked);
        const leader = ranked[0];
        setPoolLeader(leader ? { name: leader.name, points: leader.points, correctPicks: leader.correctPicks } : null);
        setLeaderboardStatus('ready');
      }
    } catch (error) {
      debugError('Error loading pool workspace stats:', error);
      setLeaderboardStatus('error');
      setPoolLeader(null);
      setLeaderboardEntries([]);
    }
  }, [poolId, season, currentWeek, currentSeasonType]);

  useEffect(() => {
    setActivePoolTab('overview');
    loadStats();
  }, [poolId, loadStats]);

  const handleCopyPicksLink = async () => {
    const url = `${window.location.origin}/pool/${poolId}/picks?week=${currentWeek}&seasonType=${currentSeasonType}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const poolStats = [
    { label: 'Participants', value: String(selectedPoolStats.participants), sub: 'In this pool',    accent: text },
    { label: 'Pending',      value: String(selectedPoolStats.pending),      sub: 'Need picks',      accent: amber },
    { label: 'Completed',    value: String(selectedPoolStats.completed),    sub: 'Picks submitted', accent: greenHi },
    { label: 'Completion',   value: `${selectedPoolStats.completionRate}%`, sub: 'Rate',            accent: 'oklch(59% 0.18 230)' },
  ];

  const hasPlayoffs = seasonScope?.includes(3) ?? false;
  const hasRegularSeason = seasonScope?.includes(2) ?? true;

  return (
    <div>
      {/* Pool info card */}
      <div style={{ background: surface, border: `1px solid ${border}`, borderTop: `3px solid ${green}`, borderRadius: 10, padding: '1.25rem 1.5rem', marginBottom: '0.75rem' }}>
        <div className='pool-identity' style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'center', paddingBottom: '1rem', marginBottom: '1rem', borderBottom: `1px solid ${border}` }}>
          <div>
            <p style={{ ...bc, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Pool</p>
            <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text }}>{poolName}</p>
          </div>
          <div>
            <p style={{ ...bc, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Year</p>
            <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text }}>{season}</p>
          </div>
          <div>
            <p style={{ ...bc, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Current Week</p>
            <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text }}>{currentWeek}</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div>
              <p style={{ ...bc, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.22em', color: textDim, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Picks Page</p>
              <button
                onClick={handleCopyPicksLink}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  background: linkCopied ? 'oklch(46% 0.14 155 / 0.15)' : 'transparent',
                  color: linkCopied ? greenHi : textMid,
                  border: `1px solid ${linkCopied ? 'oklch(46% 0.14 155 / 0.4)' : border}`,
                  borderRadius: 5, cursor: 'pointer',
                  transition: 'all 0.15s',
                  ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}
              >
                {linkCopied
                  ? <><Check style={{ width: 11, height: 11 }} /> Copied!</>
                  : <><Link2 style={{ width: 11, height: 11 }} /> Copy Link</>}
              </button>
            </div>
            {isActive !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: isActive ? green : textDim, flexShrink: 0 }} />
                <span style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, color: isActive ? greenHi : textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem' }}>
          {poolStats.map(({ label, value, sub, accent }) => (
            <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '0.875rem 1rem' }}>
              <p style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color: accent, lineHeight: 1, letterSpacing: '0.02em' }}>{value}</p>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', color: text, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: '0.25rem' }}>{label}</p>
              <p style={{ ...b, fontSize: '0.65rem', color: textDim, marginTop: '0.1rem' }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: 'oklch(17% 0.028 255)', border: `1px solid ${border}`, borderRadius: 8, padding: '0.25rem', display: 'flex', gap: '0.15rem', overflowX: 'auto', marginBottom: '0.75rem' }} className="hide-scrollbar">
        {([
          { id: 'overview',       label: 'Overview',       icon: TrendingUp },
          { id: 'players',        label: 'Players',        icon: Users },
          { id: 'leaderboard',    label: 'Leaderboard',    icon: BarChart3 },
          { id: 'override-picks', label: 'Override Picks', icon: Edit },
          { id: 'season-review',  label: 'Season Review',  icon: Calendar },
          { id: 'playoffs',       label: 'Playoffs',       icon: Trophy },
          ...(showExportTab ? [{ id: 'export' as const, label: 'Export', icon: Download }] : []),
          { id: 'settings',       label: 'Settings',       icon: Settings },
        ] as const)
          .filter(t => t.id !== 'playoffs' || hasPlayoffs)
          .filter(t => t.id !== 'season-review' || hasRegularSeason)
          .map(({ id, label, icon: Icon }) => {
          const active = activePoolTab === id;
          return (
            <button
              key={id}
              onClick={() => setActivePoolTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.45rem 0.75rem', flexShrink: 0,
                background: active ? green : 'transparent',
                color: active ? text : textMid,
                border: `1px solid ${active ? green : 'transparent'}`,
                borderRadius: 6, cursor: 'pointer',
                ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase',
              }}
            >
              <Icon style={{ width: 13, height: 13 }} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Overview tab */}
      {activePoolTab === 'overview' && (
        <>
          {poolLeader && (
            <div style={{ background: 'oklch(19% 0.04 72)', border: `1px solid oklch(35% 0.1 72)`, borderLeft: `4px solid ${gold}`, borderRadius: 10, padding: '1.1rem 1.5rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'oklch(74% 0.16 72 / 0.18)', border: `1px solid oklch(74% 0.16 72 / 0.45)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trophy style={{ width: 18, height: 18, color: gold }} />
              </div>
              <div>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.56rem', letterSpacing: '0.22em', color: gold, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Pool Leader</p>
                <p style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text, letterSpacing: '0.02em' }}>
                  {poolLeader.name}
                  <span style={{ color: textMid, fontWeight: 600, fontSize: '0.9rem' }}>{' '}· {poolLeader.points} pts</span>
                </p>
                <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.1rem' }}>
                  {poolLeader.correctPicks} correct pick{poolLeader.correctPicks !== 1 ? 's' : ''} this season
                </p>
              </div>
            </div>
          )}
          {currentSeasonType !== 0 && weekGamesCount > 0 && pickWindowOpened === false && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.1rem 1.5rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Calendar style={{ width: 16, height: 16, color: textDim, flexShrink: 0 }} />
              <div>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Week {currentWeek} has not been unlocked yet
                </p>
                <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginTop: '0.2rem' }}>
                  Picks are not yet available for this week — check back closer to kickoff.
                </p>
              </div>
            </div>
          )}
          {currentSeasonType !== 0 && pickWindowOpened === true && missingParticipants.length > 0 && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.1rem 1.5rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                <AlertTriangle style={{ width: 14, height: 14, color: amber, flexShrink: 0 }} />
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Missing Picks — Week {currentWeek}</p>
                <span style={{ marginLeft: 'auto', ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em', color: amber, background: 'oklch(72% 0.16 60 / 0.12)', border: '1px solid oklch(72% 0.16 60 / 0.3)', borderRadius: 4, padding: '0.15rem 0.5rem' }}>
                  {missingParticipants.length} pending
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
                {missingParticipants.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: '0.55rem 0.75rem' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'oklch(72% 0.16 60 / 0.15)', border: '1px solid oklch(72% 0.16 60 / 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...bc, fontWeight: 800, fontSize: '0.72rem', color: amber }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ ...b, fontSize: '0.8rem', color: text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {currentSeasonType !== 0 && pickWindowOpened === true && missingParticipants.length === 0 && weekGamesCount > 0 && selectedPoolStats.participants > 0 && (
            <div style={{ background: 'oklch(18% 0.04 155)', border: `1px solid oklch(32% 0.1 155)`, borderRadius: 10, padding: '0.875rem 1.5rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: greenHi, flexShrink: 0 }} />
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: greenHi, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                All picks submitted for Week {currentWeek}
              </p>
            </div>
          )}
        </>
      )}

      {/* Players tab */}
      {activePoolTab === 'players' && (
        <ParticipantManagement poolId={poolId} poolName={poolName} />
      )}

      {/* Leaderboard tab */}
      {activePoolTab === 'leaderboard' && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <Trophy style={{ width: 16, height: 16, color: gold }} />
            <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Season Standings</p>
          </div>
          {leaderboardStatus === 'loading' ? (
            <p style={{ ...b, fontSize: '0.82rem', color: textDim }}>Loading standings…</p>
          ) : leaderboardStatus === 'error' ? (
            <p style={{ ...b, fontSize: '0.82rem', color: 'oklch(62% 0.22 25)' }}>Couldn&apos;t load standings — try refreshing the page.</p>
          ) : leaderboardEntries.length === 0 ? (
            <p style={{ ...b, fontSize: '0.82rem', color: textDim }}>No scores recorded yet for this season.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {leaderboardEntries.map((entry, index) => {
                const isLeader = index === 0 && entry.points > 0;
                return (
                  <div key={entry.participantId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'oklch(17% 0.028 255)', border: `1px solid ${border}`, borderRadius: 8 }}>
                    <span style={{ ...bc, fontWeight: 800, fontSize: '0.82rem', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isLeader ? 'oklch(74% 0.16 72 / 0.18)' : 'oklch(26% 0.03 255)', color: isLeader ? gold : textDim, border: `1px solid ${isLeader ? 'oklch(74% 0.16 72 / 0.4)' : border}` }}>
                      {index + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{entry.name}</p>
                      <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.1rem' }}>{entry.correctPicks} correct picks</p>
                    </div>
                    <p style={{ ...bc, fontWeight: 900, fontSize: '1.1rem', color: isLeader ? gold : greenHi, letterSpacing: '0.02em' }}>
                      {entry.points} <span style={{ ...b, fontWeight: 400, fontSize: '0.72rem', color: textDim }}>pts</span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Override Picks tab */}
      {activePoolTab === 'override-picks' && (
        <OverridePicksPanel poolId={poolId} poolName={poolName} currentSeason={season} seasonScope={seasonScope} />
      )}

      {/* Season Review tab */}
      {activePoolTab === 'season-review' && hasRegularSeason && (
        <SeasonReviewPanel poolId={poolId} season={season} />
      )}

      {/* Playoffs tab */}
      {activePoolTab === 'playoffs' && hasPlayoffs && (
        <div>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Trophy style={{ width: 14, height: 14, color: greenHi }} />
              <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Playoff Confidence Points</p>
            </div>
            <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>Manage playoff confidence points and view participant submission status</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => router.push(`/pool/${poolId}/playoffs`)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                <Trophy style={{ width: 12, height: 12 }} /> Manage Playoff Confidence Points
              </button>
            </div>
          </div>
          <PlayoffParticipantsList poolId={poolId} poolSeason={season} />
        </div>
      )}

      {/* Export tab */}
      {showExportTab && activePoolTab === 'export' && (
        <ExportData poolId={poolId} poolName={poolName} currentWeek={currentWeek} currentSeason={season} />
      )}

      {/* Settings tab */}
      {activePoolTab === 'settings' && (
        <PoolSettings poolId={poolId} poolName={poolName} onPoolDeleted={onPoolDeleted} />
      )}
    </div>
  );
}
