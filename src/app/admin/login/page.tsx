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
import { Shield, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { AuthProvider } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { createPageUrl } from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';

const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type AdminLoginFormData = z.infer<typeof adminLoginSchema>;

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

function AdminLoginContent() {
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

  const form = useForm<AdminLoginFormData>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: AdminLoginFormData) => {
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
    <div style={{
      background: bg,
      minHeight: '100vh',
      backgroundImage: `repeating-linear-gradient(
        0deg,
        transparent,
        transparent 59px,
        oklch(100% 0 0 / 0.022) 59px,
        oklch(100% 0 0 / 0.022) 60px
      )`,
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── NAV ── */}
      <nav style={{
        borderBottom: `1px solid ${border}`,
        background: 'oklch(13% 0.025 255 / 0.95)',
        backdropFilter: 'blur(14px)',
      }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              ...bc, fontWeight: 600, fontSize: '0.75rem',
              letterSpacing: '0.08em', color: textMid, textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Icon + Title */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: green, margin: '0 auto 1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield style={{ width: 24, height: 24, color: text }} />
            </div>
            <p style={{
              ...bc, fontWeight: 700, fontSize: '0.65rem',
              letterSpacing: '0.26em', color: greenHi,
              textTransform: 'uppercase', marginBottom: '0.4rem',
            }}>
              Commissioner Access
            </p>
            <h1 style={{
              ...bc, fontWeight: 900, fontSize: '2rem',
              color: text, letterSpacing: '0.03em', textTransform: 'uppercase',
            }}>
              Sign In
            </h1>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginTop: '0.4rem' }}>
              Manage your NFL Confidence Pool
            </p>
          </div>

          {/* Login Card */}
          <div style={{
            background: surface,
            border: `1px solid ${border}`,
            borderTop: `3px solid ${green}`,
            borderRadius: 10,
            padding: '2rem',
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
                          style={{ background: card, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.88rem' }}
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
                            style={{ background: card, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.88rem', paddingRight: '2.75rem' }}
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
                    padding: '0.7rem 1rem',
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
                      <span style={{ width: 14, height: 14, border: `2px solid oklch(50% 0.08 155)`, borderTopColor: text, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                      Signing in…
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
          <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
      </div>

      {/* ── FOOTER ── */}

      <Footer />
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <AuthProvider>
      <AdminLoginContent />
    </AuthProvider>
  );
}
