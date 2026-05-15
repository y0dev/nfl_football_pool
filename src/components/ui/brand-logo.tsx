import Image from 'next/image';

interface BrandLogoProps {
  /** icon — circular huddle mark only (square crop, dark bg matches app) */
  variant?: 'icon' | 'horizontal';
  /** Height in px for icon variant; width is derived from aspect ratio for horizontal */
  size?: number;
  className?: string;
}

/**
 * Sunday Huddle brand logo.
 * - "icon": the circular huddle mark (sh-icon.png, 505×505 crop)
 * - "horizontal": full logo with SUNDAY HUDDLE wordmark (sh-logo.png, 1254×630)
 */
export function BrandLogo({ variant = 'icon', size = 40, className }: BrandLogoProps) {
  if (variant === 'horizontal') {
    // Aspect ratio of sh-logo.png: 1254 / 630 ≈ 1.99
    const w = Math.round(size * 1.99);
    return (
      <Image
        src="/brand/sh-logo.png"
        alt="Sunday Huddle"
        width={w}
        height={size}
        style={{ objectFit: 'contain', display: 'block' }}
        className={className}
        priority
      />
    );
  }

  // Icon variant — circular container so dark-bg edges blend with app bg
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <Image
        src="/brand/sh-icon.png"
        alt="Sunday Huddle"
        fill
        style={{ objectFit: 'cover', objectPosition: 'center 40%' }}
        priority
      />
    </div>
  );
}
