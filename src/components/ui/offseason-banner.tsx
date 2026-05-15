'use client';

const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const gold    = 'oklch(74% 0.16 72)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface OffseasonBannerProps {
  message?: string;
}

export function OffseasonBanner({ message }: OffseasonBannerProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      padding: '3rem 2rem',
      background: surface,
      border: `1px solid ${border}`,
      borderRadius: 10,
      textAlign: 'center',
    }}>
      <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>🏈</span>
      <p style={{
        ...bc,
        fontWeight: 800,
        fontSize: '1.1rem',
        color: gold,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Offseason
      </p>
      <p style={{ ...b, fontSize: '0.875rem', color: textMid, maxWidth: '28rem' }}>
        {message ?? 'The NFL season has ended. Check back in August when the new season kicks off.'}
      </p>
      <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>
        Games will appear here as soon as they are loaded into the system.
      </p>
    </div>
  );
}
