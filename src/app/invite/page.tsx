'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Trophy, Users, Calendar, UserPlus, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loadPool } from '@/actions/loadPools';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { createPageUrl } from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';

// Design tokens
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

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const fieldStyle = {
  background: card,
  border: `1px solid oklch(30% 0.03 255)`,
  color: text,
  borderRadius: 6,
} as const;

interface Pool {
  id: string;
  name: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
}

function InviteContent() {
  const searchParams = useSearchParams();
  const poolId = searchParams.get('pool');
  const adminEmail = searchParams.get('admin');
  const weekParam = searchParams.get('week');

  const [pool, setPool] = useState<Pool | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isJoining, setIsJoining] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [joinSuccess, setJoinSuccess] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        if (!poolId) {
          setError('Invalid invitation link. Pool ID is missing.');
          return;
        }

        // Load pool information
        const poolData = await loadPool(poolId);
        if (!poolData) {
          setError('Pool not found. This invitation may be invalid or the pool may have been deleted.');
          return;
        }

        if (!poolData.is_active) {
          setError('This pool is currently inactive and not accepting new participants.');
          return;
        }

        setPool(poolData);

        // Load current week
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || 1);

      } catch (error) {
        console.error('Error loading invite data:', error);
        setError('Failed to load pool information. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [poolId]);

  const handleJoinPool = async () => {
    if (!pool) return;

    // Validate inputs
    if (!participantName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name to join the pool.",
        variant: "destructive",
      });
      return;
    }

    if (!participantEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    // Access code validation removed - pools no longer require access codes

    setIsJoining(true);
    try {
      const response = await fetch('/api/pools/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poolId: pool.id,
          name: participantName.trim(),
          email: participantEmail.trim().toLowerCase(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to join pool');
      }

      if (result.message === 'Already joined') {
        toast({
          title: "Already Joined",
          description: `You have already joined ${result.poolName}. You can now make your picks!`,
        });
        // Redirect to participant page
        router.push(createPageUrl(`poolpicks?poolId=${pool.id}&week=${currentWeek}`));
        return;
      }

      setJoinSuccess(true);
      toast({
        title: "Successfully Joined!",
        description: `Welcome to ${result.poolName}! You can now make your picks for Week ${currentWeek}.`,
      });

      // Redirect to participant page after a short delay
      setTimeout(() => {
        router.push(createPageUrl(`poolpicks?poolId=${pool.id}&week=${currentWeek}`));
      }, 2000);

    } catch (error) {
      console.error('Error joining pool:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to join the pool. Please try again or contact the pool commissioner.';
      toast({
        title: "Join Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${border}`, borderTopColor: green, animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading…</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, padding: '1.5rem' }}>
        <div style={{
          background: card, border: `1px solid ${border}`,
          borderTop: `3px solid oklch(55% 0.14 20)`,
          borderRadius: 10, padding: '2rem',
          maxWidth: 420, width: '100%', textAlign: 'center',
        }}>
          <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: 'oklch(72% 0.12 20)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Invitation Error
          </h2>
          <p style={{ ...b, color: textMid, fontSize: '0.875rem', marginBottom: '1.25rem' }}>{error}</p>
          <Link
            href="/"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '0.6rem 1.25rem',
              background: green, color: text,
              border: 'none', borderRadius: 7,
              ...bc, fontWeight: 700, fontSize: '0.8rem',
              letterSpacing: '0.07em', textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // ── Join success state ──
  if (joinSuccess) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, padding: '1.5rem' }}>
        <div style={{
          background: card, border: `1px solid ${border}`,
          borderTop: `3px solid ${green}`,
          borderRadius: 10, padding: '2rem',
          maxWidth: 420, width: '100%', textAlign: 'center',
        }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'oklch(46% 0.14 155 / 0.2)', border: `1px solid oklch(46% 0.14 155 / 0.5)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <CheckCircle style={{ width: 24, height: 24, color: greenHi }} />
          </div>
          <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.25rem', color: greenHi, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Successfully Joined!
          </h2>
          <p style={{ ...b, color: textMid, fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Welcome to {pool?.name}! Redirecting you to make your picks...
          </p>
          <div style={{ height: 3, background: border, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: green, width: '60%', animation: 'spin 1.5s linear infinite' }} />
          </div>
          <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginTop: '0.75rem' }}>Preparing your picks page...</p>
        </div>
      </div>
    );
  }

  // ── Main invite page ──
  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'oklch(13% 0.025 255 / 0.95)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
      }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trophy style={{ width: 14, height: 14, color: text }} />
              </div>
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                Sunday Huddle
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(2rem, 4vw, 3rem) 0',
      }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            Pool Invitation
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            {pool?.name ? (
              <>
                {pool.name.split(' ').slice(0, -1).join(' ') || pool.name}
                {pool.name.split(' ').length > 1 && (
                  <><br /><span style={{ color: gold }}>{pool.name.split(' ').slice(-1)[0]}</span></>
                )}
              </>
            ) : 'Join Pool'}
          </h1>
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>You&apos;ve been invited to join this confidence pool</p>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── CONTENT ── */}
      <section style={{ background: bg, padding: '2.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Pool Information card */}
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <Trophy style={{ width: 16, height: 16, color: greenHi }} />
                  <h2 style={{ ...bc, fontWeight: 800, fontSize: '1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', margin: 0 }}>
                    {pool?.name}
                  </h2>
                </div>
                <p style={{ ...b, color: textDim, fontSize: '0.82rem' }}>Pool details</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users style={{ width: 14, height: 14, color: textDim, flexShrink: 0 }} />
                  <span style={{ ...b, fontSize: '0.85rem', color: textMid }}>
                    Pool Commissioner: <span style={{ color: text }}>{adminEmail || 'Unknown'}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar style={{ width: 14, height: 14, color: textDim, flexShrink: 0 }} />
                  <span style={{ ...b, fontSize: '0.85rem', color: textMid }}>
                    Current Week: <span style={{ color: text }}>{currentWeek}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Join Form card */}
            <div style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${green}`, borderRadius: 10, padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <UserPlus style={{ width: 16, height: 16, color: greenHi }} />
                  <h2 style={{ ...bc, fontWeight: 800, fontSize: '1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', margin: 0 }}>
                    Join Pool
                  </h2>
                </div>
                <p style={{ ...b, color: textDim, fontSize: '0.82rem' }}>Enter your information to join {pool?.name}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div>
                  <Label
                    htmlFor="name"
                    style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}
                  >
                    Full Name *
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="Enter your full name"
                    style={fieldStyle}
                  />
                </div>

                <div>
                  <Label
                    htmlFor="email"
                    style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', color: textMid, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}
                  >
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={participantEmail}
                    onChange={(e) => setParticipantEmail(e.target.value)}
                    placeholder="Enter your email address"
                    style={fieldStyle}
                  />
                </div>

                <button
                  onClick={handleJoinPool}
                  disabled={isJoining}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    width: '100%', padding: '0.65rem 1.25rem',
                    background: isJoining ? 'oklch(36% 0.10 155)' : green,
                    color: text, border: 'none', borderRadius: 7,
                    ...bc, fontWeight: 700, fontSize: '0.82rem',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: isJoining ? 'not-allowed' : 'pointer',
                    opacity: isJoining ? 0.7 : 1,
                  }}
                >
                  <UserPlus style={{ width: 14, height: 14 }} />
                  {isJoining ? 'Joining Pool...' : 'Join Pool'}
                </button>

                <p style={{ ...b, fontSize: '0.75rem', color: textDim, textAlign: 'center' }}>
                  By joining this pool, you agree to participate in the Sunday Huddle and follow the pool&apos;s rules.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer pageName="Leaderboard" />
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(13% 0.025 255)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid oklch(26% 0.03 255)', borderTopColor: 'oklch(46% 0.14 155)', animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
          <p style={{ fontFamily: 'var(--font-barlow)', color: 'oklch(72% 0.015 255)', fontSize: '0.9rem' }}>Loading…</p>
        </div>
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
