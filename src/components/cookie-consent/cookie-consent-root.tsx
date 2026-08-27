'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  ESSENTIAL_COOKIE_INVENTORY,
  OPTIONAL_COOKIE_CATEGORIES,
  getStoredCookieConsent,
  setCookieConsent,
} from '@/lib/cookie-consent';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

export const OPEN_COOKIE_PREFERENCES_EVENT = 'sh-cookie-preferences:open';

/** Fired by the footer's "Cookie Preferences" link (and anything else that
 * wants to reopen the preferences dialog) — CookieConsentRoot is mounted
 * once at the root layout and listens for this globally, so callers don't
 * need a context/prop chain down to wherever they happen to render. */
export function openCookiePreferences() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT));
}

const buttonBase: React.CSSProperties = {
  ...bc,
  fontWeight: 700,
  fontSize: '0.75rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '0.6rem 1.1rem',
  borderRadius: 6,
  cursor: 'pointer',
};

export function CookieConsentRoot() {
  // `mounted` follows the same client-only-render idiom as AuthProvider's
  // isMounted guard (src/lib/auth.tsx) — before mount, showBanner below is
  // always false, matching the server-rendered output 1:1, so there is no
  // hydration mismatch from a cookie value that's only readable in the browser.
  const [mounted, setMounted] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    // SSR/hydration guard: document.cookie isn't readable during server
    // render, so `mounted` must flip after the client mounts, exactly like
    // AuthProvider's isMounted in src/lib/auth.tsx — this rule's heuristic
    // just doesn't recognize the pattern when it's the effect's only setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    const openHandler = () => setShowPreferences(true);
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openHandler);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openHandler);
  }, []);

  // Derived at render time rather than mirrored into its own effect-driven
  // state — getStoredCookieConsent() is a cheap, side-effect-free read.
  const showBanner = mounted && !dismissedThisSession && !getStoredCookieConsent();

  const acknowledge = () => {
    setCookieConsent('acknowledged');
    setDismissedThisSession(true);
  };

  return (
    <>
      {showBanner && (
        <div
          role="region"
          aria-label="Cookie notice"
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9990,
            background: card, borderTop: `1px solid ${border}`,
            padding: '1rem clamp(1rem, 4vw, 1.5rem)',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ ...b, fontSize: '0.85rem', color: textMid, lineHeight: 1.6, flex: '1 1 320px', margin: 0 }}>
              Sunday Huddle only uses cookies required to keep the site working. We don&rsquo;t use analytics,
              advertising, or tracking cookies.{' '}
              <Link href="/privacy#cookies" style={{ color: greenHi }}>Learn more</Link>
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setShowPreferences(true)}
                style={{ ...buttonBase, background: 'transparent', color: textMid, border: `1px solid ${border}` }}
              >
                Cookie Settings
              </button>
              <button
                type="button"
                onClick={acknowledge}
                style={{ ...buttonBase, background: green, color: text, border: 'none' }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ ...bc, color: text, textTransform: 'uppercase', fontSize: '1.05rem', letterSpacing: '0.02em' }}>
              Cookie Preferences
            </DialogTitle>
            <DialogDescription style={{ ...b, color: textMid, fontSize: '0.8rem' }}>
              What Sunday Huddle stores in your browser, and why.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                padding: '0.85rem 1rem', background: surface, border: `1px solid ${border}`, borderRadius: 8,
              }}
            >
              <div>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: text, textTransform: 'uppercase', margin: 0 }}>
                  Required / Essential
                </p>
                <p style={{ ...b, fontSize: '0.78rem', color: textMid, margin: '0.3rem 0 0', lineHeight: 1.5 }}>
                  Needed to keep you logged in, remember your pool selections, and complete sign-up. Always on —
                  cannot be turned off.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked="true"
                aria-label="Required cookies — always on, cannot be disabled"
                disabled
                style={{
                  flexShrink: 0, width: 40, height: 22, borderRadius: 999, background: green,
                  position: 'relative', border: 'none', opacity: 0.55, cursor: 'not-allowed', padding: 0,
                }}
              >
                <span style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: text }} />
              </button>
            </div>

            <div>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.14em', color: textDim, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                What this covers
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {ESSENTIAL_COOKIE_INVENTORY.map((item) => (
                  <li key={item.name} style={{ ...b, fontSize: '0.78rem', color: textMid, lineHeight: 1.55 }}>
                    <code style={{ color: text, fontFamily: 'monospace' }}>{item.name}</code> — {item.purpose}{' '}
                    <span style={{ color: textDim }}>({item.duration})</span>
                  </li>
                ))}
              </ul>
            </div>

            {OPTIONAL_COOKIE_CATEGORIES.length === 0 && (
              <p style={{ ...b, fontSize: '0.8rem', color: textDim, lineHeight: 1.6, margin: 0 }}>
                Sunday Huddle does not currently use analytics, advertising, or tracking cookies, so there are no
                optional categories to turn on or off here. See our{' '}
                <Link href="/privacy#cookies" style={{ color: greenHi }} onClick={() => setShowPreferences(false)}>
                  Privacy Policy
                </Link>{' '}
                for the full list.
              </p>
            )}

            <button
              type="button"
              onClick={() => { acknowledge(); setShowPreferences(false); }}
              style={{ ...buttonBase, background: green, color: text, border: 'none', alignSelf: 'flex-start' }}
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
