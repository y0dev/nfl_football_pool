'use client';

import { AuthProvider } from '@/lib/auth';
import { AdminLogin } from '@/components/auth/auth-form';
import { UserSelection } from '@/components/auth/user-selection';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy } from 'lucide-react';

function LoginContent() {
  const [authMode, setAuthMode] = useState<'user' | 'admin'>('user');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Trophy className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">NFL Confidence Pool</h1>
          <p className="text-gray-600 dark:text-gray-300">Sign in to access your pools</p>
        </div>

        <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as 'user' | 'admin')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="user">Select User</TabsTrigger>
            <TabsTrigger value="admin">Admin Login</TabsTrigger>
          </TabsList>
          <TabsContent value="user">
            <UserSelection />
          </TabsContent>
          <TabsContent value="admin">
            <AdminLogin />
          </TabsContent>
        </Tabs>
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