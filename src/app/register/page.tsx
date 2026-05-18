'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Trophy, BarChart3, Calendar, Bell, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth, AuthProvider } from '@/lib/auth';
import { loginUser } from '@/actions/loginUser';
import { useRouter } from 'next/navigation';
import { createPageUrl, debugLog } from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';
import { BrandLogo } from '@/components/ui/brand-logo';

// Design tokens — match landing page
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

const FEATURES = [
  { icon: Trophy,    label: 'Confidence Pools',   desc: 'Assign point values to every pick and outsmart the competition.' },
  { icon: BarChart3, label: 'Live Leaderboards',  desc: 'Real-time standings update as Sunday scores roll in.' },
  { icon: Calendar,  label: 'Period Winners',      desc: 'Q1-Q4 and playoff prizes keep the season exciting all year.' },
  { icon: Bell,      label: 'Pick Reminders',      desc: 'Automated emails so no one misses a deadline.' },
];

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

function RegisterContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);
  const { user, signIn, verifyAdminStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      if (user && verifyAdminStatus) {
        debugLog('Checking admin status for user:', user.email);
        const isSuperAdmin = await verifyAdminStatus(true);
        router.push(isSuperAdmin ? '/admin/dashboard' : '/dashboard');
      }
    };
    check();
  }, [user, router, verifyAdminStatus]);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setFormError('');
    try {
      const response = await fetch('/api/admin/create-commissioner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password, fullName: data.fullName }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        const loginResult = await loginUser(data.email, data.password);
        if (loginResult.success && loginResult.user) {
          await signIn(loginResult.user);
          window.location.href = loginResult.user.is_super_admin
            ? createPageUrl('admindashboard')
            : createPageUrl('dashboard');
        } else {
          window.location.href = createPageUrl('login');
        }
      } else {
        setFormError(result.error || 'Failed to create account. Please try again.');
      }
    } catch {
      setFormError('Registration failed. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-split">

      {/* MARKETING PANEL */}
      <div
        className="login-split-marketing"
        style={{
          background: bg,
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px),
            repeating-linear-gradient(90deg, transparent, transparent 59px, oklch(100% 0 0 / 0.012) 59px, oklch(100% 0 0 / 0.012) 60px)
          `,
          borderRight: `1px solid ${border}`,
          padding: '3rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: green }} />

        {/* Logo */}
        <Link href="/" style={{ display: 'inline-block', textDecoration: 'none', marginBottom: '4rem' }}>
          <BrandLogo variant="horizontal" size={68} />
        </Link>

        {/* Headline */}
        <div style={{ marginBottom: '3rem' }}>
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.28em', color: greenHi, textTransform: 'uppercase', marginBottom: '1rem' }}>
            NFL Confidence Pools
          </p>
          <h2 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(2.2rem, 3.5vw, 3rem)', color: text, lineHeight: 1.05, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '1.25rem' }}>
            Where Champions<br />
            <span style={{ color: gold }}>Are Made</span>
          </h2>
          <p style={{ ...b, fontSize: '0.95rem', color: textMid, lineHeight: 1.6, maxWidth: '38ch' }}>
            Run your NFL confidence pool with ease. Set up picks, track scores, and crown winners all in one place.
          </p>
        </div>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '3.5rem' }}>
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'oklch(46% 0.14 155 / 0.15)',
                border: '1px solid oklch(46% 0.14 155 / 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon style={{ width: 16, height: 16, color: greenHi }} />
              </div>
              <div>
                <p style={{ ...bc, fontWeight: 700, fontSize: '0.88rem', color: text, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  {label}
                </p>
                <p style={{ ...b, fontSize: '0.8rem', color: textDim, lineHeight: 1.5 }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: '1.5rem' }}>
          <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '0.6rem' }}>
            Already have an account?
          </p>
          <Link
            href={createPageUrl('login')}
            style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: greenHi, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* FORM PANEL */}
      <div className="login-split-form" style={{ background: surface, display: 'flex', flexDirection: 'column' }}>

        {/* Mobile-only brand bar */}
        <div className="login-mobile-brand" style={{
          borderBottom: `1px solid ${border}`,
          background: bg,
          padding: '0.9rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <BrandLogo variant="icon" size={28} />
            <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Sunday Huddle
            </span>
          </Link>
          <Link
            href={createPageUrl('login')}
            style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', color: greenHi, textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            Sign In
          </Link>
        </div>

        {/* Form content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2.5rem 2.5rem' }}>

          {/* Icon + Title */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <BrandLogo variant="icon" size={52} />
            </div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Commissioner Access
            </p>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: '2.25rem', color: text, letterSpacing: '0.03em', textTransform: 'uppercase', lineHeight: 1 }}>
              Create Account
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginTop: '0.5rem' }}>
              Join Sunday Huddle as a commissioner
            </p>
          </div>

          {/* Register Card */}
          <div style={{
            background: card,
            border: `1px solid ${border}`,
            borderTop: `3px solid ${green}`,
            borderRadius: 10,
            padding: '2rem',
            marginBottom: '1.5rem',
          }}>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }} noValidate>

                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase' }}>
                        Display Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Your name (shown in the pool)"
                          autoComplete="name"
                          style={{ background: bg, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.88rem' }}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage style={{ ...b, fontSize: '0.78rem', color: errRed }} />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase' }}>
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="commissioner@example.com"
                          autoComplete="email"
                          style={{ background: bg, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.88rem' }}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage style={{ ...b, fontSize: '0.78rem', color: errRed }} />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase' }}>
                        Password
                      </FormLabel>
                      <FormControl>
                        <div style={{ position: 'relative' }}>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
                            style={{ background: bg, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.88rem', paddingRight: '2.75rem' }}
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 0.75rem', background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage style={{ ...b, fontSize: '0.78rem', color: errRed }} />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase' }}>
                        Confirm Password
                      </FormLabel>
                      <FormControl>
                        <div style={{ position: 'relative' }}>
                          <Input
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="Repeat your password"
                            autoComplete="new-password"
                            style={{ background: bg, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.88rem', paddingRight: '2.75rem' }}
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 0.75rem', background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            {showConfirm ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage style={{ ...b, fontSize: '0.78rem', color: errRed }} />
                    </FormItem>
                  )}
                />

                {/* Success banner */}
                {success && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.75rem 1rem', background: 'oklch(46% 0.14 155 / 0.12)', border: '1px solid oklch(46% 0.14 155 / 0.4)', borderRadius: 6 }}>
                    <CheckCircle2 style={{ width: 16, height: 16, color: greenHi, flexShrink: 0, marginTop: 1 }} />
                    <p style={{ ...b, fontSize: '0.825rem', color: greenHi, margin: 0 }}>
                      Account created! Taking you to your dashboard…
                    </p>
                  </div>
                )}

                {/* Error banner */}
                {formError && !success && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.75rem 1rem', background: 'oklch(62% 0.22 25 / 0.1)', border: '1px solid oklch(62% 0.22 25 / 0.4)', borderRadius: 6 }}>
                    <AlertCircle style={{ width: 16, height: 16, color: errRed, flexShrink: 0, marginTop: 1 }} />
                    <p style={{ ...b, fontSize: '0.825rem', color: errRed, margin: 0 }}>
                      {formError}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || success}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: isLoading || success ? 'oklch(35% 0.08 155)' : green,
                    color: text, border: 'none', borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.85rem',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    marginTop: '0.25rem',
                  }}
                >
                  {success ? (
                    <>
                      <span style={{ width: 14, height: 14, border: '2px solid oklch(50% 0.08 155)', borderTopColor: text, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                      Redirecting…
                    </>
                  ) : isLoading ? (
                    <>
                      <span style={{ width: 14, height: 14, border: '2px solid oklch(50% 0.08 155)', borderTopColor: text, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                      Creating Account…
                    </>
                  ) : (
                    'Create Commissioner Account'
                  )}
                </button>
              </form>
            </Form>
          </div>

          {/* Footer links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>
              Already have an account?
            </p>
            <Link
              href={createPageUrl('login')}
              style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: greenHi, textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              Sign In to Dashboard
            </Link>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <AuthProvider>
      <RegisterContent />
    </AuthProvider>
  );
}
