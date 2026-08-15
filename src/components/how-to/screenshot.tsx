'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ZoomIn, X } from 'lucide-react';

const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const textDim = 'oklch(50% 0.018 255)';
const b = { fontFamily: 'var(--font-barlow)' } as const;

export interface ScreenshotProps {
  src: string;
  /** Required, specific alt text — never "screenshot". Describe what's shown. */
  alt: string;
  /** Optional caption shown below the image. */
  caption?: string;
  width?: number;
  height?: number;
}

/** A documentation screenshot. Tap/click to view larger — useful on mobile
 * where the inline image is necessarily small. */
export function Screenshot({ src, alt, caption, width = 1280, height = 800 }: ScreenshotProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <figure style={{ margin: 0 }}>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Expand screenshot: ${alt}`}
          style={{
            display: 'block', width: '100%', padding: 0, border: `1px solid ${border}`, borderRadius: 10,
            overflow: 'hidden', background: card, cursor: 'zoom-in', position: 'relative',
          }}
        >
          <Image src={src} alt={alt} width={width} height={height} style={{ width: '100%', height: 'auto', display: 'block' }} />
          <span style={{
            position: 'absolute', bottom: '0.5rem', right: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem',
            background: 'oklch(13% 0.025 255 / 0.75)', color: '#fff', borderRadius: 6, padding: '0.25rem 0.5rem', fontSize: '0.68rem', ...b,
          }}>
            <ZoomIn style={{ width: 12, height: 12 }} /> Tap to enlarge
          </span>
        </button>
        {caption && (
          <figcaption style={{ ...b, fontSize: '0.78rem', color: textDim, marginTop: '0.5rem', textAlign: 'center' }}>{caption}</figcaption>
        )}
      </figure>

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setExpanded(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999, background: 'oklch(10% 0.02 255 / 0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', cursor: 'zoom-out',
          }}
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Close enlarged screenshot"
            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'oklch(20% 0.03 255)', border: `1px solid ${border}`, borderRadius: 8, padding: '0.5rem', color: '#fff', cursor: 'pointer' }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
