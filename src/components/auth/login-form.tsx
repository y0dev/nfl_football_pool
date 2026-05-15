'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { loginUser } from '@/actions/loginUser';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';

// Design tokens
const bg      = 'oklch(13% 0.025 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
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

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { toast } = useToast();
  const { signIn } = useAuth();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setLoginError(null); // Clear any previous errors

    try {
      const result = await loginUser(data.email, data.password);

      if (result.success && result.user) {
        console.log('LoginForm: Login successful:', result.user);
        // Set the user in the auth context
        await signIn(result.user);

        toast({
          title: 'Success',
          description: 'Login successful!',
        });

        // Redirect based on admin status
        if (result.user.is_super_admin) {
          window.location.href = '/admin/dashboard';
        } else {
          window.location.href = '/dashboard';
        }
      } else {
        const errorMessage = result.error || 'Invalid credentials';
        setLoginError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Login failed. Please try again.';
      setLoginError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      background: card,
      border: `1px solid ${border}`,
      borderTop: `3px solid ${green}`,
      borderRadius: 10,
      padding: '2rem',
    }}>
      {/* Card header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.05em', color: text, textTransform: 'uppercase', margin: 0 }}>
          Sign In
        </h2>
        <p style={{ ...b, color: textMid, fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Enter your credentials to access your account
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', color: textMid, textTransform: 'uppercase' }}>
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    autoComplete="email"
                    style={fieldStyle}
                    {...field}
                  />
                </FormControl>
                <FormMessage style={{ ...b, fontSize: '0.78rem', color: amber }} />
              </FormItem>
            )}
          />

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
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete="current-password"
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

          {/* Display login error prominently */}
          {loginError && (
            <div style={{
              padding: '0.75rem 1rem',
              background: 'oklch(25% 0.06 20)',
              border: '1px solid oklch(40% 0.1 20)',
              borderRadius: 7,
            }}>
              <p style={{ ...b, fontSize: '0.82rem', color: 'oklch(75% 0.12 20)', textAlign: 'center', fontWeight: 600, margin: 0 }}>
                {loginError}
              </p>
            </div>
          )}

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
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </Form>
    </div>
  );
}
