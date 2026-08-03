'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, X, ChevronDown, LogOut, Settings, Receipt, Shield, Plus } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';

const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

export interface AppNavLink {
  label: string;
  href: string;
}

export interface AppNavProps {
  /** Authenticated as a commissioner/super-admin in THIS browser session —
   * not the same thing as a pool participant being "signed in" (see
   * src/lib/user-session.ts) since this app has two separate auth models.
   * Pages that don't wrap in AuthProvider (e.g. pool-picks-content.tsx)
   * determine this themselves and pass it in. */
  isAuthenticated: boolean;
  isSuperAdmin?: boolean;
  onSignOut?: () => void | Promise<void>;
  /** Present when rendered inside a specific pool's pages — scopes the
   * Picks/Leaderboard links to that pool instead of the pool-agnostic
   * fallbacks (Dashboard's pool list / the commissioner leaderboard tool). */
  poolId?: string;
  /** Page-specific extra links (e.g. the landing page's How It
   * Works/FAQ/Pricing, or the dashboard's Huddles) — kept separate from the
   * primary items so the Home/Dashboard/Picks/Leaderboard pattern stays
   * identical everywhere else. */
  extraLinks?: AppNavLink[];
}

function useDismissable(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handlePointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);
  return ref;
}

export function AppNav({ isAuthenticated, isSuperAdmin, onSignOut, poolId, extraLinks }: AppNavProps) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close both menus on route change so navigating never leaves a stale
  // open panel behind.
  useEffect(() => {
    setAccountOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  const accountRef = useDismissable(() => setAccountOpen(false));
  const mobileRef = useDismissable(() => setMobileOpen(false));

  const dashboardHref = isSuperAdmin ? '/admin/dashboard' : '/dashboard';
  const picksHref = poolId ? `/pool/${poolId}/picks` : '/dashboard';
  const leaderboardHref = isAuthenticated
    ? (poolId ? `/pool/${poolId}/leaderboard` : '/leaderboard')
    : (poolId ? `/pool/${poolId}/leaderboard` : '/pools');

  const primaryLinks: AppNavLink[] = isAuthenticated
    ? [
        { label: 'Home', href: '/' },
        { label: 'Dashboard', href: dashboardHref },
        { label: 'Picks', href: picksHref },
        { label: 'Leaderboard', href: leaderboardHref },
      ]
    : [
        { label: 'Home', href: '/' },
        { label: 'Leaderboard', href: leaderboardHref },
      ];

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  const linkStyle = (active: boolean): React.CSSProperties => ({
    ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em',
    color: active ? text : textMid, textTransform: 'uppercase', textDecoration: 'none',
    borderBottom: active ? `2px solid ${greenHi}` : '2px solid transparent',
    paddingBottom: '0.2rem', whiteSpace: 'nowrap',
  });

  const handleSignOut = async () => {
    setAccountOpen(false);
    setMobileOpen(false);
    await onSignOut?.();
  };

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'oklch(13% 0.025 255 / 0.95)',
      backdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${border}`,
    }}>
      <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>

          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0, textDecoration: 'none', flexShrink: 0 }}>
            <BrandLogo variant="icon" size={30} />
            <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Sunday Huddle
            </span>
          </Link>

          {/* Desktop: primary links + extra links + account dropdown */}
          <div className="app-nav-desktop" style={{ display: 'none', alignItems: 'center', gap: '1.75rem', flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              {primaryLinks.map(link => (
                <Link key={link.label} href={link.href} style={linkStyle(isActive(link.href))}>
                  {link.label}
                </Link>
              ))}
              {extraLinks?.map(link => (
                <Link key={link.label} href={link.href} style={linkStyle(isActive(link.href))}>
                  {link.label}
                </Link>
              ))}
            </div>

            {isAuthenticated ? (
              <div ref={accountRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setAccountOpen(o => !o)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.45rem 0.85rem', background: 'transparent', color: textMid,
                    border: `1px solid ${border}`, borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em',
                    textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Account <ChevronDown style={{ width: 13, height: 13, transition: 'transform 0.15s', transform: accountOpen ? 'rotate(180deg)' : 'none' }} />
                </button>
                {accountOpen && (
                  <div
                    role="menu"
                    style={{
                      position: 'absolute', top: 'calc(100% + 0.5rem)', right: 0, minWidth: 200,
                      background: 'oklch(20% 0.03 255)', border: `1px solid ${border}`, borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden',
                      animation: 'app-nav-dropdown-in 0.12s ease-out',
                    }}
                  >
                    <AccountMenuItems onSignOut={handleSignOut} />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link href="/login" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  <Shield style={{ width: 14, height: 14 }} /> Sign In
                </Link>
                <Link href="/register" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  <Plus style={{ width: 14, height: 14 }} /> Create Account
                </Link>
              </div>
            )}
          </div>

          {/* Mobile: hamburger only */}
          <button
            className="app-nav-hamburger"
            onClick={() => setMobileOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={mobileOpen}
            aria-controls="app-nav-mobile-panel"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, background: 'transparent', border: `1px solid ${border}`,
              borderRadius: 6, color: text, cursor: 'pointer', flexShrink: 0,
            }}
          >
            {mobileOpen ? <X style={{ width: 18, height: 18 }} /> : <Menu style={{ width: 18, height: 18 }} />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      <div
        id="app-nav-mobile-panel"
        ref={mobileRef}
        className="app-nav-mobile-panel"
        role="menu"
        style={{
          maxHeight: mobileOpen ? 600 : 0,
          opacity: mobileOpen ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.22s ease, opacity 0.18s ease',
          borderBottom: mobileOpen ? `1px solid ${border}` : 'none',
          background: 'oklch(15% 0.026 255)',
        }}
      >
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <p style={mobileSectionLabel}>Navigation</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {[...primaryLinks, ...(extraLinks ?? [])].map(link => (
                <MobileLink key={link.label} href={link.href} active={isActive(link.href)}>{link.label}</MobileLink>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: border }} />

          {isAuthenticated ? (
            <>
              <div>
                <p style={mobileSectionLabel}>Account</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <MobileLink href="/admin/account" active={isActive('/admin/account') && !isActive('/admin/account/purchases')}>Settings</MobileLink>
                  <MobileLink href="/admin/account/purchases" active={isActive('/admin/account/purchases')}>Purchases</MobileLink>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem',
                  background: 'transparent', border: `1px solid oklch(62% 0.22 25 / 0.4)`, borderRadius: 6,
                  color: 'oklch(62% 0.22 25)', ...bc, fontWeight: 700, fontSize: '0.8rem',
                  letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <LogOut style={{ width: 14, height: 14 }} /> Sign Out
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <Link href="/login" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', background: 'transparent', color: text, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
                <Shield style={{ width: 14, height: 14 }} /> Sign In
              </Link>
              <Link href="/register" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
                <Plus style={{ width: 14, height: 14 }} /> Create Account
              </Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes app-nav-dropdown-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 768px) {
          .app-nav-desktop { display: flex !important; }
          .app-nav-hamburger { display: none !important; }
          .app-nav-mobile-panel { display: none !important; }
        }
      `}</style>
    </nav>
  );
}

const mobileSectionLabel: React.CSSProperties = {
  ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.18em',
  color: textDim, textTransform: 'uppercase', marginBottom: '0.5rem',
};

function MobileLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      style={{
        display: 'block', padding: '0.55rem 0.75rem', borderRadius: 6,
        background: active ? 'oklch(46% 0.14 155 / 0.12)' : 'transparent',
        color: active ? greenHi : text, textDecoration: 'none',
        ...b, fontWeight: active ? 700 : 500, fontSize: '0.9rem',
      }}
    >
      {children}
    </Link>
  );
}

function AccountMenuItems({ onSignOut }: { onSignOut: () => void }) {
  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.55rem', width: '100%',
    padding: '0.65rem 0.9rem', background: 'transparent', border: 'none',
    color: textMid, ...b, fontSize: '0.85rem', textAlign: 'left', cursor: 'pointer', textDecoration: 'none',
  };
  return (
    <>
      <Link href="/admin/account" role="menuitem" style={itemStyle}>
        <Settings style={{ width: 14, height: 14 }} /> Settings
      </Link>
      <Link href="/admin/account/purchases" role="menuitem" style={itemStyle}>
        <Receipt style={{ width: 14, height: 14 }} /> Purchases
      </Link>
      <div style={{ height: 1, background: border }} />
      <button role="menuitem" onClick={onSignOut} style={{ ...itemStyle, color: 'oklch(62% 0.22 25)' }}>
        <LogOut style={{ width: 14, height: 14 }} /> Sign Out
      </button>
    </>
  );
}
