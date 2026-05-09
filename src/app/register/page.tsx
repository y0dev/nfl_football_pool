'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Shield, Eye, EyeOff, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useAuth, AuthProvider } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { debugLog } from '@/lib/utils';

// Design tokens
const bg      = 'oklch(13% 0.025 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const fieldStyle = {
  background: card,
  border: `1px solid oklch(30% 0.03 255)`,
  color: text,
  borderRadius: 6,
} as const;

const adminRegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AdminRegisterFormData = z.infer<typeof adminRegisterSchema>;

function AdminRegisterContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const { user, verifyAdminStatus } = useAuth();
  const router = useRouter();

  // Redirect if user is already logged in
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        // Check admin status first
        if (user && verifyAdminStatus) {
          debugLog('Checking admin status for user:', user.email);
          const superAdminStatus = await verifyAdminStatus(true);

          // Redirect commissioners to their dashboard
          if (!superAdminStatus) {
            router.push('/dashboard');
            return;
          }

          // Redirect super admins to admin dashboard
          router.push('/admin/dashboard');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        // Don't crash the component on auth errors
      }
    };

    checkAdminStatus();
  }, [user, router, verifyAdminStatus]);

  const form = useForm<AdminRegisterFormData>({
    resolver: zodResolver(adminRegisterSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
    },
  });

  const onSubmit = async (data: AdminRegisterFormData) => {
    if (!data || !data.email || !data.password || !data.fullName) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Sending registration request...');
      const response = await fetch('/api/admin/create-commissioner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          fullName: data.fullName,
        }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Response data:', result);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Commissioner account created successfully! You can now log in with your credentials.',
        });
        // Redirect to commissioner dashboard
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 2000);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create admin account',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Commissioner registration error:', error);
      toast({
        title: 'Error',
        description: 'Registration failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>

      {/* Branding */}
      <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.85rem' }}>
          <Shield style={{ width: 24, height: 24, color: text }} />
        </div>
        <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.4rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', margin: 0 }}>
          Create Commissioner Account
        </h1>
        <p style={{ ...b, color: textMid, fontSize: '0.875rem', marginTop: '0.35rem' }}>
          Join the NFL Confidence Pool as a commissioner
        </p>
      </div>

      {/* Form card */}
      <div style={{
        background: card,
        border: `1px solid ${border}`,
        borderTop: `3px solid ${green}`,
        borderRadius: 10,
        padding: '2rem',
        maxWidth: 460,
        width: '100%',
      }}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} noValidate>

            {/* Full Name */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', color: textMid, textTransform: 'uppercase' }}>
                    Full Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      style={fieldStyle}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage style={{ ...b, fontSize: '0.78rem', color: amber }} />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', color: textMid, textTransform: 'uppercase' }}>
                    Email Address
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      style={fieldStyle}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage style={{ ...b, fontSize: '0.78rem', color: amber }} />
                </FormItem>
              )}
            />

            {/* Password */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', color: textMid, textTransform: 'uppercase' }}>
                    Password
                  </FormLabel>
                  <FormControl>
                    <div style={{ position: 'relative' }}>
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a strong password"
                        style={{ ...fieldStyle, paddingRight: '2.75rem' }}
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute', right: 0, top: 0,
                          height: '100%', padding: '0 0.75rem',
                          background: 'transparent', border: 'none',
                          color: textDim, cursor: 'pointer',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage style={{ ...b, fontSize: '0.78rem', color: amber }} />
                </FormItem>
              )}
            />

            {/* Confirm Password */}
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', color: textMid, textTransform: 'uppercase' }}>
                    Confirm Password
                  </FormLabel>
                  <FormControl>
                    <div style={{ position: 'relative' }}>
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm your password"
                        style={{ ...fieldStyle, paddingRight: '2.75rem' }}
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{
                          position: 'absolute', right: 0, top: 0,
                          height: '100%', padding: '0 0.75rem',
                          background: 'transparent', border: 'none',
                          color: textDim, cursor: 'pointer',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        {showConfirmPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage style={{ ...b, fontSize: '0.78rem', color: amber }} />
                </FormItem>
              )}
            />

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                width: '100%', padding: '0.65rem 1.25rem',
                background: isLoading ? 'oklch(36% 0.10 155)' : green,
                color: text,
                border: 'none', borderRadius: 7,
                ...bc, fontWeight: 700, fontSize: '0.82rem',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                marginTop: '0.5rem',
              }}
            >
              {isLoading ? (
                <>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${text}`, borderTopColor: 'transparent', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                  Creating Account...
                </>
              ) : (
                'Create Commissioner Account'
              )}
            </button>
          </form>
        </Form>

        {/* Divider */}
        <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: 1, background: border }} />
          <span style={{ ...b, fontSize: '0.78rem', color: textDim }}>Already have an account?</span>
          <div style={{ flex: 1, height: 1, background: border }} />
        </div>

        <Link
          href="/login"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            width: '100%', padding: '0.6rem 1rem',
            background: 'transparent', color: textMid,
            border: `1px solid ${border}`, borderRadius: 7,
            ...bc, fontWeight: 700, fontSize: '0.78rem',
            letterSpacing: '0.07em', textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Sign in to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function AdminRegisterPage() {
  return (
    <AuthProvider>
      <AdminRegisterContent />
    </AuthProvider>
  );
}
