'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, Plus, LogOut, RefreshCw } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';

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

function SuperAdminContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSuperAdmin, setIsCreatingSuperAdmin] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();

  // Redirect if user is not logged in or not an admin
  useEffect(() => {
    if (user && !user.is_super_admin) {
      router.push('/admin/dashboard');
    }
  }, [user, router]);

  // Form states for creating admin
  const [superAdminForm, setSuperAdminForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });

  // Set loading to false on mount
  useEffect(() => {
    setIsLoading(false);
  }, []);

  const createSuperAdmin = async () => {
    if (superAdminForm.password !== superAdminForm.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingSuperAdmin(true);
    try {
      const response = await fetch('/api/super-admin/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: superAdminForm.email,
          password: superAdminForm.password,
          fullName: superAdminForm.fullName,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Admin account created successfully!',
        });
        setSuperAdminForm({ email: '', password: '', confirmPassword: '', fullName: '' });

        // Redirect to admin dashboard after a short delay
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 2000);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create admin',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating admin:', error);
      toast({
        title: 'Error',
        description: 'Failed to create admin',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingSuperAdmin(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      router.push('/admin/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const isFormValid =
    !!superAdminForm.email &&
    !!superAdminForm.password &&
    !!superAdminForm.fullName &&
    superAdminForm.password === superAdminForm.confirmPassword;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield style={{ width: 14, height: 14, color: text }} />
              </div>
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                Admin HQ
              </span>
            </div>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.7rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 5,
                ...bc, fontWeight: 600, fontSize: '0.72rem',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              <LogOut style={{ width: 11, height: 11 }} />
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(2rem, 4vw, 3rem) 0',
      }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            Super Admin
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Admin <span style={{ color: gold }}>Dashboard</span>
          </h1>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid }}>
            Manage commissioner accounts and system settings
          </p>
        </div>
      </section>

      {/* green rule */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* CONTENT */}
      <section style={{ background: bg, padding: '2.5rem 0' }}>
        <div className="lp-inner">

          {/* Create Admin Card */}
          <div style={{
            background: card,
            border: `1px solid ${border}`,
            borderRadius: 10,
            padding: '1.75rem',
            maxWidth: 540,
          }}>
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <Plus style={{ width: 15, height: 15, color: greenHi, flexShrink: 0 }} />
              <p style={{ ...bc, fontWeight: 800, fontSize: '0.95rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Create Admin
              </p>
            </div>
            <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.5rem' }}>
              Create a new administrator account
            </p>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

              {/* Full Name */}
              <div>
                <Label htmlFor="fullName" style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  value={superAdminForm.fullName}
                  onChange={(e) => setSuperAdminForm({ ...superAdminForm, fullName: e.target.value })}
                  placeholder="Enter full name"
                  style={{ background: surface, border: `1px solid ${border}`, color: text, marginTop: '0.35rem' }}
                />
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email" style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={superAdminForm.email}
                  onChange={(e) => setSuperAdminForm({ ...superAdminForm, email: e.target.value })}
                  placeholder="admin@example.com"
                  style={{ background: surface, border: `1px solid ${border}`, color: text, marginTop: '0.35rem' }}
                />
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password" style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={superAdminForm.password}
                  onChange={(e) => setSuperAdminForm({ ...superAdminForm, password: e.target.value })}
                  placeholder="Enter password (min 8 characters)"
                  style={{ background: surface, border: `1px solid ${border}`, color: text, marginTop: '0.35rem' }}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <Label htmlFor="confirmPassword" style={{ ...bc, fontSize: '0.7rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={superAdminForm.confirmPassword}
                  onChange={(e) => setSuperAdminForm({ ...superAdminForm, confirmPassword: e.target.value })}
                  placeholder="Confirm password"
                  style={{ background: surface, border: `1px solid ${border}`, color: text, marginTop: '0.35rem' }}
                />
                {superAdminForm.confirmPassword && superAdminForm.password !== superAdminForm.confirmPassword && (
                  <p style={{ ...b, fontSize: '0.72rem', color: 'oklch(62% 0.22 25)', marginTop: '0.35rem' }}>
                    Passwords do not match
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={createSuperAdmin}
                disabled={isCreatingSuperAdmin || !isFormValid}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  width: '100%', padding: '0.65rem 1rem',
                  background: isCreatingSuperAdmin || !isFormValid ? 'oklch(20% 0.02 255)' : green,
                  color: isCreatingSuperAdmin || !isFormValid ? textDim : text,
                  border: `1px solid ${isCreatingSuperAdmin || !isFormValid ? border : green}`,
                  borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.8rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: isCreatingSuperAdmin || !isFormValid ? 'not-allowed' : 'pointer',
                  marginTop: '0.25rem',
                }}
              >
                {isCreatingSuperAdmin ? (
                  <>
                    <RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />
                    Creating…
                  </>
                ) : (
                  <>
                    <Plus style={{ width: 13, height: 13 }} />
                    Create Admin
                  </>
                )}
              </button>

            </div>
          </div>

        </div>
      </section>

    </div>
  );
}

export default function SuperAdminPage() {
  return (
    <AuthProvider>
      <AdminGuard requireSuperAdmin={true}>
        <SuperAdminContent />
      </AdminGuard>
    </AuthProvider>
  );
}
