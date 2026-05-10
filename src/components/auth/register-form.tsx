'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { createUser } from '@/actions/createUser';
import { useAuth } from '@/lib/auth';
import { Eye, EyeOff } from 'lucide-react';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const red     = 'oklch(60% 0.22 25)';
const text    = 'oklch(95% 0.006 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const labelStyle = { ...bc, fontSize: '0.68rem', fontWeight: 700 as const, color: textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block' };
const inputStyle = { ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box' as const, fontSize: '0.875rem', marginTop: '0.35rem' };

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  pool_id: z.string().min(1, 'Please select a pool'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signIn } = useAuth();

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', pool_id: '' },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const user = await createUser({ name: data.name, email: data.email, poolId: data.pool_id });
      if (user) {
        await signIn(data.email, '');
        console.log('Account created successfully');
      }
    } catch (error) {
      console.error('Failed to create account:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const eyeBtn = { position: 'absolute' as const, right: 0, top: 0, height: '100%', padding: '0 0.75rem', background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', display: 'flex', alignItems: 'center' };

  return (
    <div style={{ width: '100%', maxWidth: '28rem', margin: '0 auto', background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.75rem' }}>
      <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Create Account</p>
      <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1.5rem' }}>Join the Sunday Huddle community</p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel style={labelStyle}>Name</FormLabel>
                <FormControl>
                  <input placeholder="Enter your name" {...field} style={inputStyle} />
                </FormControl>
                <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel style={labelStyle}>Email</FormLabel>
                <FormControl>
                  <input type="email" placeholder="Enter your email" {...field} style={inputStyle} />
                </FormControl>
                <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel style={labelStyle}>Password</FormLabel>
                <FormControl>
                  <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                    <input type={showPassword ? 'text' : 'password'} placeholder="Enter your password" {...field} style={{ ...inputStyle, marginTop: 0, paddingRight: '2.5rem' }} />
                    <button type="button" style={eyeBtn} onClick={() => setShowPassword(v => !v)}>
                      {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel style={labelStyle}>Confirm Password</FormLabel>
                <FormControl>
                  <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                    <input type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm your password" {...field} style={{ ...inputStyle, marginTop: 0, paddingRight: '2.5rem' }} />
                    <button type="button" style={eyeBtn} onClick={() => setShowConfirmPassword(v => !v)}>
                      {showConfirmPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pool_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel style={labelStyle}>Pool ID</FormLabel>
                <FormControl>
                  <input placeholder="Enter pool ID" {...field} style={inputStyle} />
                </FormControl>
                <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
              </FormItem>
            )}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{ ...bc, width: '100%', padding: '0.6rem', background: isLoading ? border : green, color: isLoading ? textDim : text, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '0.25rem' }}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      </Form>
    </div>
  );
}
