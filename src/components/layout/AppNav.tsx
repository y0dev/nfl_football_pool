'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, X, LogOut } from 'lucide-react';
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
  /** When true, never highlight this link as active — for fallback hrefs
   * that reuse another link's destination (e.g. Picks falling back to the
   * Dashboard when there's no pool in context) and shouldn't be mistaken
   * for that page's own nav entry. */
  forceInactive?: boolean;
}

export interface AppNavSection {
  label: string;
  links: AppNavLink[];
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
  /** Page-specific extra sections (e.g. the commissioner dashboard's
   * "Huddles & Pools", or the landing page's "Learn More") — merged in
   * alongside the built-in Navigation/Admin Tools/Account sections. */
  extraSections?: AppNavSection[];
  /** Page-specific live-action controls that aren't navigation destinations
   * (a Refresh button, a Sync Now button) — rendered next to the Menu
   * trigger rather than folded into the dropdown, since triggering them
   * doesn't navigate anywhere. */
  rightSlot?: React.ReactNode;
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

export function AppNav({ isAuthenticated, isSuperAdmin, onSignOut, poolId, extraSections, rightSlot }: AppNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  const menuRef = useDismissable(() => setOpen(false));

  const dashboardHref = isSuperAdmin ? '/admin/dashboard' : '/dashboard';
  const picksHref = poolId ? `/pool/${poolId}/picks` : dashboardHref;
  const leaderboardHref = isAuthenticated
    ? (poolId ? `/pool/${poolId}/leaderboard` : '/leaderboard')
    : (poolId ? `/pool/${poolId}/leaderboard` : '/pools');

  const navigationLinks: AppNavLink[] = isAuthenticated
    ? [
        { label: 'Home', href: '/' },
        { label: 'Dashboard', href: dashboardHref },
        { label: 'Picks', href: picksHref, forceInactive: !poolId },
        { label: 'Leaderboard', href: leaderboardHref },
      ]
    : [
        { label: 'Home', href: '/' },
        { label: 'Leaderboard', href: leaderboardHref },
      ];

  // Every super-admin tool page links back to these same destinations —
  // built in here instead of repeated as extraSections on all ten admin pages.
  const adminToolsLinks: AppNavLink[] = [
    { label: 'My Huddles', href: '/league' },
    { label: 'All Pools', href: '/admin/pools' },
    { label: 'Manage Commissioners', href: '/admin/commissioners' },
    { label: 'Add Commissioner', href: '/admin/create-commissioner' },
    { label: 'Manage Admins', href: '/admin/manage-admins' },
    { label: 'Playoff Management', href: '/admin/playoffs' },
    { label: 'NFL Sync', href: '/admin/nfl-sync' },
    { label: 'Season Games', href: '/admin/season-games' },
  ];

  const accountLinks: AppNavLink[] = isAuthenticated
    ? [{ label: 'Settings', href: '/admin/account' }, { label: 'Purchases', href: '/admin/account/purchases' }]
    : [{ label: 'Sign In', href: '/login' }, { label: 'Create Account', href: '/register' }];

  const sections: AppNavSection[] = [
    { label: 'Navigation', links: navigationLinks },
    ...(isSuperAdmin ? [{ label: 'Admin Tools', links: adminToolsLinks }] : []),
    ...(extraSections ?? []),
    { label: isAuthenticated ? 'Account' : 'Get Started', links: accountLinks },
  ];

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  const handleSignOut = async () => {
    setOpen(false);
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {rightSlot}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls="app-nav-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.75rem', background: 'transparent', color: text,
                border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer',
                ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase',
              }}
            >
              {open ? <X style={{ width: 16, height: 16 }} /> : <Menu style={{ width: 16, height: 16 }} />}
              Menu
            </button>

            <div
              id="app-nav-menu"
              role="menu"
              className="app-nav-panel"
              style={{
                position: 'absolute', top: 'calc(100% + 0.5rem)', right: 0,
                width: 280, maxWidth: 'calc(100vw - 2rem)', maxHeight: open ? '80vh' : 0,
                overflowY: 'auto', overflowX: 'hidden',
                background: 'oklch(15% 0.026 255)', border: open ? `1px solid ${border}` : 'none',
                borderRadius: 10, boxShadow: open ? '0 12px 32px rgba(0,0,0,0.45)' : 'none',
                opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
                transition: 'max-height 0.2s ease, opacity 0.15s ease',
              }}
            >
              <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sections.filter(s => s.links.length > 0).map(section => (
                  <div key={section.label}>
                    <p style={sectionLabelStyle}>{section.label}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      {section.links.map(link => (
                        <MenuLink key={link.label} href={link.href} active={!link.forceInactive && isActive(link.href)}>
                          {link.label}
                        </MenuLink>
                      ))}
                    </div>
                  </div>
                ))}

                {isAuthenticated && (
                  <button
                    role="menuitem"
                    onClick={handleSignOut}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.65rem',
                      background: 'transparent', border: `1px solid oklch(62% 0.22 25 / 0.4)`, borderRadius: 6,
                      color: 'oklch(62% 0.22 25)', ...bc, fontWeight: 700, fontSize: '0.78rem',
                      letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <LogOut style={{ width: 13, height: 13 }} /> Sign Out
                  </button>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 480px) {
          .app-nav-panel { position: fixed !important; top: 60px !important; left: 1rem !important; right: 1rem !important; width: auto !important; }
        }
      `}</style>
    </nav>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.16em',
  color: textDim, textTransform: 'uppercase', margin: '0 0 0.35rem 0.1rem',
};

function MenuLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      style={{
        display: 'block', padding: '0.5rem 0.65rem', borderRadius: 6,
        background: active ? 'oklch(46% 0.14 155 / 0.14)' : 'transparent',
        color: active ? greenHi : textMid, textDecoration: 'none',
        ...b, fontWeight: active ? 700 : 500, fontSize: '0.87rem',
      }}
    >
      {children}
    </Link>
  );
}
