'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { Search, Users, Lock, CheckCircle, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrandLogo } from '@/components/ui/brand-logo';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const errRed  = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface Pool {
  id: string;
  name: string;
  season: number;
  participant_count: number;
  requires_password: boolean;
}

type JoinState = 'idle' | 'joining' | 'success' | 'already_joined';

function PoolsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery]             = useState(searchParams.get('q') || '');
  const [pools, setPools]             = useState<Pool[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [joinName, setJoinName]         = useState('');
  const [joinEmail, setJoinEmail]       = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [honeypot, setHoneypot]         = useState('');
  const [formLoadedAt, setFormLoadedAt] = useState(0);
  const [joinState, setJoinState]       = useState<JoinState>('idle');
  const [joinError, setJoinError]       = useState('');

  const formRef = useRef<HTMLDivElement>(null);

  const searchPools = async (q: string) => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/pools?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setPools(data.pools || []);
    } catch {
      setPools([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Run search from URL param on mount/change
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
    if (q.trim()) searchPools(q);
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/pools?q=${encodeURIComponent(query.trim())}`);
  };

  const openJoinForm = (pool: Pool) => {
    setSelectedPool(pool);
    setJoinName('');
    setJoinEmail('');
    setJoinPassword('');
    setHoneypot('');
    setJoinState('idle');
    setJoinError('');
    setFormLoadedAt(Date.now());
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPool) return;

    // Bot detection: honeypot
    if (honeypot) return;

    // Bot detection: form submitted too fast (< 1.5 s)
    if (Date.now() - formLoadedAt < 1500) {
      setJoinError('Please take a moment to fill in your details.');
      return;
    }

    if (!joinName.trim()) { setJoinError('Please enter your name.'); return; }
    if (!joinEmail.trim() || !joinEmail.includes('@')) { setJoinError('Please enter a valid email address.'); return; }
    if (selectedPool.requires_password && !joinPassword.trim()) { setJoinError('This pool requires a password.'); return; }

    setJoinState('joining');
    setJoinError('');

    try {
      const res = await fetch('/api/pools/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId: selectedPool.id,
          name: joinName.trim(),
          email: joinEmail.trim().toLowerCase(),
          password: joinPassword,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setJoinState(data.message === 'Already joined' ? 'already_joined' : 'success');
      } else {
        setJoinState('idle');
        setJoinError(data.error || 'Failed to join. Please try again.');
      }
    } catch {
      setJoinState('idle');
      setJoinError('Connection error. Please try again.');
    }
  };

  const inputStyle: React.CSSProperties = {
    ...b, display: 'block', width: '100%', boxSizing: 'border-box',
    background: bg, border: `1px solid ${border}`, color: text,
    borderRadius: 6, padding: '0.55rem 0.75rem', fontSize: '0.88rem',
  };
  const labelStyle: React.CSSProperties = {
    ...bc, display: 'block', fontSize: '0.65rem', fontWeight: 700,
    letterSpacing: '0.1em', color: textDim, textTransform: 'uppercase', marginBottom: '0.35rem',
  };

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'oklch(13% 0.025 255 / 0.95)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
      }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', color: textMid, textTransform: 'uppercase', padding: '0.35rem 0.6rem', border: `1px solid ${border}`, borderRadius: 5 }}>
                <ArrowLeft style={{ width: 12, height: 12 }} />
                Home
              </Link>
              <div style={{ width: 1, height: 20, background: border }} />
              <BrandLogo variant="horizontal" size={28} />
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(2.5rem, 5vw, 4rem) 0',
      }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Find &amp; Join
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.25rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '1.25rem' }}>
            Active<br /><span style={{ color: gold }}>Pools</span>
          </h1>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', maxWidth: 500 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: textDim }} />
              <input
                data-testid="pool-search-input"
                placeholder="Search by pool name…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '2.25rem' }}
              />
            </div>
            <button
              type="submit"
              disabled={!query.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0 1.1rem',
                background: query.trim() ? green : border, color: text,
                border: 'none', borderRadius: 6,
                ...bc, fontWeight: 700, fontSize: '0.78rem',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: query.trim() ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              <Search style={{ width: 13, height: 13 }} />
              Search
            </button>
          </form>
        </div>
      </section>

      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* RESULTS */}
      <section style={{ background: surface, padding: '2.5rem 0', minHeight: 300 }}>
        <div className="lp-inner">

          {isSearching ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '3rem 0' }}>
              <RefreshCw style={{ width: 20, height: 20, color: textDim, animation: 'spin 1s linear infinite' }} />
              <span style={{ ...b, color: textDim, fontSize: '0.9rem' }}>Searching pools…</span>
            </div>
          ) : hasSearched && pools.length === 0 ? (
            <div style={{ padding: '3rem 0', textAlign: 'center' }}>
              <p style={{ ...b, color: textMid, fontSize: '0.95rem', marginBottom: '0.4rem' }}>No active pools found matching &ldquo;{searchParams.get('q')}&rdquo;</p>
              <p style={{ ...b, color: textDim, fontSize: '0.82rem' }}>Check the name with your commissioner or try a different search.</p>
            </div>
          ) : !hasSearched ? (
            <div style={{ padding: '3rem 0', textAlign: 'center' }}>
              <p style={{ ...b, color: textDim, fontSize: '0.9rem' }}>Search for a pool by name above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.14em', color: textDim, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                {pools.length} pool{pools.length !== 1 ? 's' : ''} found
              </p>

              {pools.map(pool => (
                <div
                  key={pool.id}
                  data-testid="pool-card"
                  style={{
                    background: card, border: `1px solid ${border}`,
                    borderLeft: `3px solid ${selectedPool?.id === pool.id ? greenHi : green}`,
                    borderRadius: 8, padding: '1.25rem 1.5rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '1rem', flexWrap: 'wrap',
                    transition: 'border-left-color 0.15s',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <span style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {pool.name}
                      </span>
                      {pool.requires_password && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.1em',
                          color: gold, textTransform: 'uppercase',
                          background: 'oklch(74% 0.16 72 / 0.12)', border: `1px solid oklch(74% 0.16 72 / 0.3)`,
                          padding: '0.1rem 0.4rem', borderRadius: 4,
                        }}>
                          <Lock style={{ width: 8, height: 8 }} /> Password Required
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', ...b, fontSize: '0.78rem', color: textMid }}>
                        <Users style={{ width: 13, height: 13, color: textDim }} />
                        {pool.participant_count} member{pool.participant_count !== 1 ? 's' : ''}
                      </span>
                      <span style={{ ...b, fontSize: '0.78rem', color: textDim }}>{pool.season} Season</span>
                    </div>
                  </div>

                  {selectedPool?.id === pool.id && (joinState === 'success' || joinState === 'already_joined') ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', ...bc, fontWeight: 700, fontSize: '0.78rem', color: greenHi, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      <CheckCircle style={{ width: 14, height: 14 }} />
                      {joinState === 'already_joined' ? 'Already Joined' : 'Joined!'}
                    </div>
                  ) : (
                    <button
                      onClick={() => openJoinForm(pool)}
                      style={{
                        padding: '0.5rem 1.1rem',
                        background: selectedPool?.id === pool.id ? greenHi : green,
                        color: text, border: 'none', borderRadius: 6,
                        ...bc, fontWeight: 700, fontSize: '0.78rem',
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        cursor: 'pointer', flexShrink: 0,
                        transition: 'background 0.15s',
                      }}
                    >
                      {selectedPool?.id === pool.id ? 'Joining…' : 'Join Pool'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* JOIN FORM */}
          {selectedPool && joinState !== 'success' && joinState !== 'already_joined' && (
            <div
              ref={formRef}
              data-testid="join-form"
              style={{
                marginTop: '1.5rem',
                background: card,
                border: `1px solid ${border}`,
                borderTop: `3px solid ${green}`,
                borderRadius: 10,
                padding: '2rem',
              }}
            >
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.22em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                Joining
              </p>
              <h2 style={{ ...bc, fontWeight: 900, fontSize: '1.35rem', color: text, textTransform: 'uppercase', marginBottom: '1.5rem' }}>
                {selectedPool.name}
              </h2>

              <form onSubmit={handleJoin} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Honeypot — invisible to humans, bots fill it */}
                <input
                  name="website"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
                />

                <div>
                  <label style={labelStyle}>Your Name</label>
                  <input
                    data-testid="join-name"
                    placeholder="How you appear in the pool standings"
                    value={joinName}
                    onChange={e => setJoinName(e.target.value)}
                    style={inputStyle}
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input
                    data-testid="join-email"
                    type="email"
                    placeholder="your@email.com"
                    value={joinEmail}
                    onChange={e => setJoinEmail(e.target.value)}
                    style={inputStyle}
                    autoComplete="email"
                  />
                </div>

                {selectedPool.requires_password && (
                  <div>
                    <label style={labelStyle}>Pool Password</label>
                    <input
                      data-testid="join-password"
                      type="password"
                      placeholder="Enter the pool password"
                      value={joinPassword}
                      onChange={e => setJoinPassword(e.target.value)}
                      style={inputStyle}
                      autoComplete="off"
                    />
                    <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.35rem' }}>
                      Ask your commissioner for the password.
                    </p>
                  </div>
                )}

                {joinError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 0.875rem',
                    background: 'oklch(62% 0.22 25 / 0.1)',
                    border: `1px solid oklch(62% 0.22 25 / 0.3)`,
                    borderRadius: 6,
                  }}>
                    <AlertCircle style={{ width: 14, height: 14, color: errRed, flexShrink: 0 }} />
                    <span style={{ ...b, fontSize: '0.82rem', color: errRed }}>{joinError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedPool(null)}
                    style={{
                      padding: '0.6rem 1.1rem',
                      background: 'transparent', color: textMid,
                      border: `1px solid ${border}`, borderRadius: 6,
                      ...bc, fontWeight: 700, fontSize: '0.78rem',
                      letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="join-submit"
                    disabled={joinState === 'joining'}
                    style={{
                      flex: 1, padding: '0.6rem 1.1rem',
                      background: joinState === 'joining' ? border : green,
                      color: text, border: 'none', borderRadius: 6,
                      ...bc, fontWeight: 700, fontSize: '0.78rem',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      cursor: joinState === 'joining' ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    }}
                  >
                    {joinState === 'joining'
                      ? <><RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> Joining…</>
                      : 'Join Pool'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SUCCESS STATE */}
          {selectedPool && (joinState === 'success' || joinState === 'already_joined') && (
            <div
              data-testid="join-success"
              style={{
                marginTop: '1.5rem',
                background: 'oklch(46% 0.14 155 / 0.08)',
                border: `1px solid oklch(46% 0.14 155 / 0.35)`,
                borderRadius: 10,
                padding: '2rem',
                textAlign: 'center',
              }}
            >
              <CheckCircle style={{ width: 40, height: 40, color: greenHi, margin: '0 auto 1rem' }} />
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.2em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                {joinState === 'already_joined' ? 'Already a Member' : 'You\'re In!'}
              </p>
              <h3 style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', color: text, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {joinState === 'already_joined' ? `You're already in ${selectedPool.name}` : `Welcome to ${selectedPool.name}`}
              </h3>
              <p style={{ ...b, fontSize: '0.875rem', color: textMid }}>
                Your commissioner will follow up with details on submitting picks.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function PoolsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'oklch(13% 0.025 255)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw style={{ width: 28, height: 28, color: 'oklch(50% 0.018 255)', animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <PoolsContent />
    </Suspense>
  );
}
