'use client';

import { LoginForm } from '@/components/auth/login-form';
import { AuthProvider } from '@/lib/auth';
import { Trophy } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const bg    = 'oklch(13% 0.025 255)';
const green = 'oklch(46% 0.14 155)';
const text  = 'oklch(95% 0.006 255)';
const bc    = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b     = { fontFamily: 'var(--font-barlow)' } as const;

function LoginContent() {
  const { user } = useAuth();
  const router = useRouter();

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      {/* Logo / branding */}
      <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.85rem' }}>
          <Trophy style={{ width: 24, height: 24, color: text }} />
        </div>
        <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.6rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase', margin: 0 }}>
          NFL Confidence Pool
        </h1>
        <p style={{ ...b, color: 'oklch(72% 0.015 255)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
          Sign in to access your pools
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 420 }}>
        <LoginForm />
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
