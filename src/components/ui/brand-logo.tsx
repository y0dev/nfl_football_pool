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
 * - "icon": favicon with beveled corners (android-chrome-512x512.png)
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

  // Icon variant — favicon with beveled (rounded rect) corners
  const radius = Math.round(size * 0.2);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <Image
        src="/favicon/android-chrome-512x512.png"
        alt="Sunday Huddle"
        fill
        style={{ objectFit: 'cover' }}
        priority
      />
    </div>
  );
}
