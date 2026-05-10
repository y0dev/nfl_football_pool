'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { loginUser } from '@/actions/loginUser';
import { useAuth } from '@/lib/auth';
import { Shield, Eye, EyeOff, Trophy, BarChart3, Calendar, Bell } from 'lucide-react';
import Link from 'next/link';
import { AuthProvider } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { createPageUrl } from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

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

function LoginContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { signIn, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.is_super_admin) {
      router.push(createPageUrl('admindashboard'));
    } else if (user && user.is_super_admin === false) {
      router.push(createPageUrl('dashboard'));
    }
  }, [user, router]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await loginUser(data.email, data.password);
      if (result.success && result.user) {
        await signIn(result.user);
        toast({ title: 'Success', description: 'Login successful!' });
        if (result.user.is_super_admin) {
          window.location.href = createPageUrl('admindashboard');
        } else {
          window.location.href = createPageUrl('dashboard');
        }
      } else {
        toast({ title: 'Error', description: result.error || 'Invalid credentials', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Login failed. Please try again.', variant: 'destructive' });
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
        {/* Green left-edge accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: green }} />

        {/* Logo */}
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', marginBottom: '4rem' }}
        >
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield style={{ width: 16, height: 16, color: text }} />
          </div>
          <span style={{ ...bc, fontWeight: 800, fontSize: '1.05rem', color: text, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Sunday Huddle
          </span>
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
            Don't have an account yet?
          </p>
          <Link
            href={createPageUrl('register')}
            style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: greenHi, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            Create an Account
          </Link>
        </div>
      </div>

      {/* FORM PANEL */}
      <div
        className="login-split-form"
        style={{ background: surface, display: 'flex', flexDirection: 'column' }}
      >
        {/* Mobile-only brand bar */}
        <div style={{
          borderBottom: `1px solid ${border}`,
          background: bg,
          padding: '0.9rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        className="login-mobile-brand"
        >
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield style={{ width: 12, height: 12, color: text }} />
            </div>
            <span style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Sunday Huddle
            </span>
          </Link>
          <Link
            href={createPageUrl('register')}
            style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', color: greenHi, textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            Create Account
          </Link>
        </div>

        {/* Form content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem 2.5rem' }}>

          {/* Icon + Title */}
          <div style={{ marginBottom: '2.25rem' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Shield style={{ width: 24, height: 24, color: text }} />
            </div>
            <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Commissioner Access
            </p>
            <h1 style={{ ...bc, fontWeight: 900, fontSize: '2.25rem', color: text, letterSpacing: '0.03em', textTransform: 'uppercase', lineHeight: 1 }}>
              Sign In
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginTop: '0.5rem' }}>
              Manage your Confidence Pool
            </p>
          </div>

          {/* Login Card */}
          <div style={{
            background: card,
            border: `1px solid ${border}`,
            borderTop: `3px solid ${green}`,
            borderRadius: 10,
            padding: '2rem',
            marginBottom: '1.75rem',
          }}>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            style={{ background: bg, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.88rem', paddingRight: '2.75rem' }}
                            {...field}
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
                            {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage style={{ ...b, fontSize: '0.78rem', color: errRed }} />
                    </FormItem>
                  )}
                />

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: isLoading ? 'oklch(35% 0.08 155)' : green,
                    color: text, border: 'none', borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.85rem',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  }}
                >
                  {isLoading ? (
                    <>
                      <span style={{ width: 14, height: 14, border: '2px solid oklch(50% 0.08 155)', borderTopColor: text, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <Shield style={{ width: 14, height: 14 }} />
                      Sign In as Commissioner
                    </>
                  )}
                </button>
              </form>
            </Form>
          </div>

          {/* Footer links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>
              Need help? Contact your pool commissioner
            </p>
            <Link
              href={createPageUrl('register')}
              style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: greenHi, textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              Create Commissioner Account
            </Link>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginContent />
    </AuthProvider>
  );
}
