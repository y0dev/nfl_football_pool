'use client';

import { useAuth, AuthProvider } from '@/lib/auth';
import { PoolDashboard } from '@/components/pools/pool-dashboard';
import { WeeklyPick } from '@/components/picks/weekly-pick';
import { Leaderboard } from '@/components/leaderboard/leaderboard';
import { DeviceRotationPrompt } from '@/components/ui/device-rotation-prompt';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { LogOut } from 'lucide-react';
import { Suspense } from 'react';
import Link from 'next/link';

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
    </div>
  );
}

function AppContent() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">NFL Confidence Pool</h1>
            <p className="text-gray-600">Sign in to access your pools</p>
          </div>
          <Link href="/login">
            <Button className="w-full">Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">NFL Confidence Pool</h1>
          <p className="text-gray-600">Welcome, {user?.full_name || user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/login">
            <Button variant="outline" size="sm">
              Admin Login
            </Button>
          </Link>
          <Button onClick={signOut} variant="outline">
            Logout
          </Button>
        </div>
      </div>
      <PoolDashboard />
      <Tabs defaultValue="picks" className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="picks">Make Picks</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>
        <TabsContent value="picks" className="mt-6">
          <Suspense fallback={<div>Loading picks...</div>}>
            <WeeklyPick poolId="1" />
          </Suspense>
        </TabsContent>
        <TabsContent value="leaderboard" className="mt-6">
          <Suspense fallback={<div>Loading leaderboard...</div>}>
            <DeviceRotationPrompt />
            <Leaderboard />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingSpinner />}>
        <AppContent />
      </Suspense>
      <Toaster />
    </AuthProvider>
  );
}

