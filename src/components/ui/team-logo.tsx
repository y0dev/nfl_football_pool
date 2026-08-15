'use client';

import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { getTeam } from '@/lib/utils';

export type TeamLogoSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<TeamLogoSize, number> = { sm: 28, md: 44, lg: 64 };

interface TeamLogoProps {
  /** Team record from getTeam()/NFL_TEAMS — carries name, abbreviation, colors, and logo URL. */
  team: ReturnType<typeof getTeam>;
  size?: TeamLogoSize;
  /**
   * Subtle team-color circular backdrop behind the logo (borderBottom accent
   * + optional glow via `style`). Off by default so this component stays
   * neutral enough for compact list contexts; callers that want the
   * "colored badge" treatment (e.g. the picks page's team buttons) opt in.
   */
  colorAccent?: boolean;
  /**
   * Set false only when no team name/abbreviation text is visible anywhere
   * near this logo — otherwise the adjacent text is already the accessible
   * label, and this image should stay decorative (alt=""), per WCAG
   * guidance against duplicating the same information for screen readers.
   */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a team's logo (local static asset — see NFL_TEAMS in
 * lib/utils.ts) with a graceful fallback to the app's existing
 * colored-circle-abbreviation look (same design already used before logos
 * existed) when the logo URL is missing or fails to load.
 */
export function TeamLogo({ team, size = 'md', colorAccent = false, decorative = true, className, style }: TeamLogoProps) {
  const [failed, setFailed] = useState(false);
  const px = SIZE_PX[size];
  const showFallback = !team.logo || failed;

  const outerStyle: CSSProperties = {
    width: px,
    height: px,
    borderRadius: '50%',
    flexShrink: 0,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...(colorAccent
      ? { background: team.color, borderBottom: `${Math.max(2, Math.round(px / 10))}px solid ${team.color2}` }
      : {}),
    ...style,
  };

  if (showFallback) {
    return (
      <div
        className={className}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : `${team.name} logo`}
        aria-hidden={decorative ? true : undefined}
        style={{
          ...outerStyle,
          background: outerStyle.background ?? team.color,
          borderBottom: outerStyle.borderBottom ?? `${Math.max(2, Math.round(px / 10))}px solid ${team.color2}`,
          color: '#fff',
          fontWeight: 900,
          fontSize: Math.round(px * 0.28),
          letterSpacing: '0.02em',
        }}
      >
        {team.abbreviation}
      </div>
    );
  }

  const imgSize = colorAccent ? Math.round(px * 0.72) : px;

  return (
    <div className={className} style={outerStyle}>
      <div style={{ width: imgSize, height: imgSize, position: 'relative' }}>
        <Image
          src={team.logo!}
          alt={decorative ? '' : `${team.name} logo`}
          fill
          sizes={`${imgSize}px`}
          style={{ objectFit: 'contain' }}
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
}
