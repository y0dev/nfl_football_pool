'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  UserPlus,
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
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
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

function CreateCommissionerContent() {
  const { user, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [formData, setFormData] = useState({ email: '', fullName: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useState(() => {
    const checkAdminStatus = async () => {
      if (user) {
        const superAdminStatus = await verifyAdminStatus(true);
        setIsSuperAdmin(superAdminStatus);
        if (!superAdminStatus) router.push('/dashboard');
      }
    };
    checkAdminStatus();
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.fullName.trim() || !formData.password.trim()) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters long', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No active session');

      const response = await fetch('/api/admin/create-commissioner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ email: formData.email.trim(), fullName: formData.fullName.trim(), password: formData.password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create commissioner');

      toast({ title: 'Success', description: 'Commissioner created successfully' });
      setFormData({ email: '', fullName: '', password: '' });
      router.push('/admin/commissioners');
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create commissioner', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <Shield style={{ width: 48, height: 48, color: textDim, margin: '0 auto 1rem' }} />
          <h2 style={{ ...bc, fontSize: '1.25rem', color: textMid, fontWeight: 700 }}>Access Denied</h2>
          <p style={{ ...b, fontSize: '0.875rem', color: textDim, marginTop: '0.5rem' }}>Only super admins can create commissioners</p>
        </div>
      </div>
    );
  }

  const fieldStyle = {
    background: card,
    border: `1px solid ${border}`,
    color: text,
    ...b, fontSize: '0.88rem',
  };

  const labelStyle = {
    ...bc, fontSize: '0.7rem', fontWeight: 700 as const,
    letterSpacing: '0.08em', color: textDim,
    textTransform: 'uppercase' as const,
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    marginBottom: '0.4rem',
  };

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => router.push('/admin/commissioners')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.6rem',
                  background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 5,
                  ...bc, fontWeight: 600, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft style={{ width: 12, height: 12 }} />
                Back
              </button>
              <div style={{ width: 1, height: 20, background: border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserPlus style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                  Create Commissioner
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(2.5rem, 5vw, 4rem) 0',
      }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            System Administration
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Add<br /><span style={{ color: gold }}>Commissioner</span>
          </h1>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid, maxWidth: '36ch' }}>
            Create a new commissioner account with access to manage their assigned pools.
          </p>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── FORM ── */}
      <section style={{ background: surface, padding: '3rem 0' }}>
        <div className="lp-inner">
          <div style={{ maxWidth: 520 }}>
            <div style={{
              background: card,
              border: `1px solid ${border}`,
              borderLeft: `3px solid ${green}`,
              borderRadius: 8,
              padding: '2rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <UserPlus style={{ width: 18, height: 18, color: greenHi }} />
                <h2 style={{ ...bc, fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                  Commissioner Details
                </h2>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label htmlFor="email" style={labelStyle}>
                    <Mail style={{ width: 13, height: 13 }} /> Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="commissioner@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    style={fieldStyle}
                  />
                </div>

                <div>
                  <label htmlFor="fullName" style={labelStyle}>
                    <User style={{ width: 13, height: 13 }} /> Full Name
                  </label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    required
                    style={fieldStyle}
                  />
                </div>

                <div>
                  <label htmlFor="password" style={labelStyle}>
                    <Lock style={{ width: 13, height: 13 }} /> Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password (min 6 characters)"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      style={{ ...fieldStyle, paddingRight: '2.75rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: 0, top: 0, height: '100%',
                        padding: '0 0.75rem', background: 'transparent',
                        border: 'none', color: textDim, cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    style={{
                      flex: 1,
                      padding: '0.55rem 1rem',
                      background: isProcessing ? 'oklch(35% 0.08 155)' : green,
                      color: text, border: 'none', borderRadius: 6,
                      ...bc, fontWeight: 700, fontSize: '0.82rem',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    }}
                  >
                    {isProcessing
                      ? <><RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" /> Creating…</>
                      : <><UserPlus style={{ width: 13, height: 13 }} /> Create Commissioner</>
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/admin/commissioners')}
                    disabled={isProcessing}
                    style={{
                      padding: '0.55rem 1rem',
                      background: 'transparent', color: textMid,
                      border: `1px solid ${border}`, borderRadius: 6,
                      ...bc, fontWeight: 600, fontSize: '0.82rem',
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer pageName="Commissioner HQ" />
    </div>
  );
}

export default function CreateCommissionerPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <CreateCommissionerContent />
      </AdminGuard>
    </AuthProvider>
  );
}
