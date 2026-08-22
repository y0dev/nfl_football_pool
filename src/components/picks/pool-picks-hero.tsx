'use client';

import type { LucideIcon } from 'lucide-react';
import { Calendar, ChevronLeft, ChevronRight, Lock, LogOut, Trophy, Unlock } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SEASON_TYPE_OPTIONS, getMaxWeeksForSeason, getPlayoffRoundName } from '@/lib/utils';
import { computeWeekUnlockStatus } from '@/lib/week-unlock-status';

// Single source of truth for the Picks page hero — originally Confidence-only
// (src/components/picks/pool-picks-content.tsx), extracted so Pick'em and
// Survivor render the exact same layout/functionality instead of a
// simplified stand-in. Confidence's own render call is a pure extraction
// (same props, same local variables passed straight through) — this file
// changes nothing about how Confidence looks or behaves.

const bg      = 'oklch(13% 0.025 255)';
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

export type HeroWeekState = 'pool_inactive' | 'season_complete' | 'ended' | 'locked' | 'unlocked';

/** Same computation as Confidence's original `weekState` useMemo, factored
 * out so Pick'em/Survivor derive the identical state from the identical
 * rules (never a separate/simplified lock calculation) — games only need
 * kickoff_time/status, so each caller maps its own game shape into this
 * minimal one. */
export function computeHeroWeekState(params: {
  isPoolClosed: boolean;
  weekEnded: boolean;
  poolSeasonScope: number[];
  currentSeasonType: number;
  currentWeek: number;
  games: Array<{ kickoff_time: string; status?: string | null }>;
  upcomingWeek: { week: number; seasonType: number } | null;
}): HeroWeekState {
  const { isPoolClosed, weekEnded, poolSeasonScope, currentSeasonType, currentWeek, games, upcomingWeek } = params;
  if (isPoolClosed) return 'pool_inactive';
  if (weekEnded) {
    const scopeSorted = [...poolSeasonScope].sort((a, b) => a - b);
    const maxScope = scopeSorted[scopeSorted.length - 1] ?? currentSeasonType;
    const isFinalWeekOfPool = currentSeasonType === maxScope && currentWeek >= getMaxWeeksForSeason(maxScope);
    return isFinalWeekOfPool ? 'season_complete' : 'ended';
  }
  if (games.length === 0) return 'locked';
  return computeWeekUnlockStatus(games, currentWeek, currentSeasonType, upcomingWeek) ? 'unlocked' : 'locked';
}

/** Same computation as Confidence's original `unlockTime` useMemo. */
export function computeHeroUnlockTime(
  weekState: HeroWeekState,
  games: Array<{ kickoff_time: string }>,
  daysBeforeGame: number
): Date | null {
  if (weekState !== 'locked' || games.length === 0) return null;
  const earliestKickoff = games.reduce(
    (earliest, g) => Math.min(earliest, new Date(g.kickoff_time).getTime()),
    Infinity
  );
  if (!Number.isFinite(earliestKickoff)) return null;
  const unlocksAt = new Date(earliestKickoff - daysBeforeGame * 24 * 60 * 60 * 1000);
  if (unlocksAt.getTime() <= Date.now()) return null;
  return unlocksAt;
}

export function WeekNav({
  currentWeek,
  currentSeasonType,
  upcomingWeek,
  seasonScope,
  onPrev,
  onCurrent,
  onNext,
  onJumpToWeek,
}: {
  currentWeek: number;
  currentSeasonType: number;
  upcomingWeek: { week: number; seasonType: number };
  seasonScope: number[];
  onPrev: () => void;
  onCurrent: () => void;
  onNext: () => void;
  onJumpToWeek: (week: number, seasonType: number) => void;
}) {
  const isCurrentWeek = currentWeek === upcomingWeek.week && currentSeasonType === upcomingWeek.seasonType;
  const scopeSorted = [...seasonScope].sort((a, b) => a - b);
  const minScope = scopeSorted[0] ?? 2;
  const maxScope = scopeSorted[scopeSorted.length - 1] ?? 2;
  const prevDisabled = currentSeasonType <= minScope && currentWeek <= 1;
  const nextDisabled = currentSeasonType >= maxScope && currentWeek >= getMaxWeeksForSeason(maxScope);
  const btnBase: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.12s' };
  // When a pool spans more than one season type (e.g. regular season +
  // playoffs), group weeks under a section header per season type instead
  // of listing every week in one flat, unlabeled list.
  const weekGroups = scopeSorted.map((seasonType) => ({
    seasonType,
    label: SEASON_TYPE_OPTIONS.find((o) => o.value === seasonType)?.label ?? '',
    weeks: Array.from({ length: getMaxWeeksForSeason(seasonType) }, (_, i) => i + 1),
  }));
  return (
    <div className="week-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <button className='week-nav-prev' onClick={onPrev} disabled={prevDisabled} style={{ ...btnBase, background: 'transparent', color: prevDisabled ? textDim : textMid, opacity: prevDisabled ? 0.4 : 1, cursor: prevDisabled ? 'not-allowed' : 'pointer' }}>
        <ChevronLeft style={{ width: 13, height: 13 }} /> Prev
      </button>
      <button className='week-nav-current' onClick={onCurrent} style={{ ...btnBase, background: isCurrentWeek ? green : 'transparent', color: isCurrentWeek ? text : textMid, borderColor: isCurrentWeek ? green : border }}>
        <Calendar style={{ width: 12, height: 12 }} /> Current
      </button>
      <button className='week-nav-next' onClick={onNext} disabled={nextDisabled} style={{ ...btnBase, background: 'transparent', color: nextDisabled ? textDim : textMid, opacity: nextDisabled ? 0.4 : 1, cursor: nextDisabled ? 'not-allowed' : 'pointer' }}>
        Next <ChevronRight style={{ width: 13, height: 13 }} />
      </button>
      <Select
        value={`${currentSeasonType}-${currentWeek}`}
        onValueChange={(v) => {
          const [seasonType, week] = v.split('-').map(Number);
          onJumpToWeek(week, seasonType);
        }}
      >
        <SelectTrigger aria-label="Jump to week" className="week-nav-select-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {weekGroups.map((group) => (
            <SelectGroup key={group.seasonType}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.weeks.map((week) => {
                const isCurrent = week === upcomingWeek.week && group.seasonType === upcomingWeek.seasonType;
                const itemLabel = group.seasonType === 3 ? getPlayoffRoundName(week) : `Week ${week}`;
                return (
                  <SelectItem key={`${group.seasonType}-${week}`} value={`${group.seasonType}-${week}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>{itemLabel}</span>
                      {isCurrent && (
                        <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.05em', color: greenHi, textTransform: 'uppercase' }}>
                          (Current Week)
                        </span>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface PoolPicksHeroAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

export interface PoolPicksHeroProps {
  poolName: string;
  isTestMode?: boolean;
  /** getWeekTitle() result — e.g. "Preseason Week 2", "Week 5", or a
   * playoff round name. Same utility, same distinguishing logic, every
   * competition type. */
  weekTitle: string;
  /** Second (gold) word after the week title — "Picks" for every type
   * that hasn't been told otherwise. */
  titleAccent?: string;
  /** Pass a <WeekNav .../> element, or omit entirely for a competition type
   * with no multi-week browsing model (Survivor — see that page's own
   * comment for why). Never a simplified nav; either the real one or none. */
  weekNav?: React.ReactNode;
  itemCountLabel: string;
  seasonTypeName: string;
  weekState: HeroWeekState;
  /** Whether any of this week's games have actually started (as opposed to
   * merely not-yet-unlocked) — determines which "locked" message to show. */
  gamesStarted: boolean;
  unlockTime: Date | null;
  unlockFallbackMessage: string;
  /** Dev-only "Updated {time}" badge — same NODE_ENV gate as Confidence's. */
  lastUpdated?: Date | null;
  /** One-line instruction specific to the competition type. Confidence's
   * own hero has never had one (its "{weekTitle} Picks" heading + "Learn
   * how" link already say enough) — passing this is what lets Pick'em/
   * Survivor show their own terminology without adding anything to
   * Confidence's unchanged render. */
  subtitle?: string;
  actions?: PoolPicksHeroAction[];
  learnMoreHref?: string;
  /** e.g. "picks" / "Pick'em" / "Survivor" — filled into "Not sure how
   * {learnMoreText} work?" */
  learnMoreText?: string;
}

export function PoolPicksHero({
  poolName, isTestMode, weekTitle, titleAccent = 'Picks', weekNav, itemCountLabel, seasonTypeName,
  weekState, gamesStarted, unlockTime, unlockFallbackMessage, lastUpdated, subtitle,
  actions = [], learnMoreHref, learnMoreText = 'picks',
}: PoolPicksHeroProps) {
  const badge = {
    pool_inactive:   { text: 'Pool Inactive',    icon: LogOut,   color: textDim },
    season_complete: { text: 'Season Complete',  icon: Trophy,   color: gold },
    ended:           { text: 'Week Ended',       icon: Calendar, color: textMid },
    locked:          { text: 'Locked',           icon: Lock,     color: amber },
    unlocked:        { text: 'Unlocked',         icon: Unlock,   color: greenHi },
  }[weekState];
  const BadgeIcon = badge.icon;

  return (
    <section
      id="hero"
      style={{ background: bg, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`, padding: 'clamp(1.5rem, 3vw, 2.5rem) 0' }}>
      <div className="lp-inner">
        <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
          {poolName}
          {isTestMode && <span style={{ ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.08em', padding: '0.1rem 0.4rem', borderRadius: 4, background: `oklch(72% 0.16 60 / 0.2)`, color: amber, border: `1px solid oklch(72% 0.16 60 / 0.4)`, textTransform: 'uppercase' }}>Test Mode</span>}
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: text, textTransform: 'uppercase' }}>
            {weekTitle} <span style={{ color: gold }}>{titleAccent}</span>
          </h1>
          {weekNav}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>{itemCountLabel}</span>
          <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textMid, border: `1px solid ${border}` }}>{seasonTypeName}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: badge.color, border: `1px solid ${border}` }}>
            <BadgeIcon style={{ width: 11, height: 11 }} /> {badge.text}
          </span>
          {process.env.NODE_ENV === 'development' && lastUpdated && <span style={{ ...b, fontSize: '0.68rem', color: textDim }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
        </div>

        {subtitle && (
          <p style={{ ...b, fontSize: '0.85rem', color: textMid, marginTop: '0.5rem' }}>{subtitle}</p>
        )}

        {weekState === 'locked' && !gamesStarted && (
          <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginTop: '0.4rem' }}>
            {unlockTime
              ? `Picks unlock ${unlockTime.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`
              : unlockFallbackMessage}
          </p>
        )}

        {actions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.85rem' }}>
            {actions.map(({ label, icon: Icon, onClick }) => (
              <button key={label} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <Icon style={{ width: 12, height: 12 }} /> {label}
              </button>
            ))}
          </div>
        )}

        {learnMoreHref && (
          <a href={learnMoreHref} target="_blank" rel="noopener noreferrer" style={{ ...b, fontSize: '0.75rem', color: textDim, textDecoration: 'none', display: 'inline-block', marginTop: '0.6rem' }}>
            Not sure how {learnMoreText} work? <span style={{ textDecoration: 'underline' }}>Learn how →</span>
          </a>
        )}
      </div>
    </section>
  );
}
