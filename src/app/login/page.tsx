'use client';

import { LoginForm } from '@/components/auth/login-form';
import { AuthProvider } from '@/lib/auth';
import { Trophy } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Trophy className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">NFL Confidence Pool</h1>
          <p className="text-gray-600">Sign in to access your pools</p>
        </div>
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