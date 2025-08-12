'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Leaderboard } from '@/components/leaderboard/leaderboard';
import { WeeklyPick } from '@/components/picks/weekly-pick';
import { LiveGames } from '@/components/live-games';
import { DeviceRotationPrompt } from '@/components/ui/device-rotation-prompt';
import { AdminLogin } from '@/components/auth/auth-form';
import { PoolDashboard } from '@/components/pools/pool-dashboard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { Toaster } from '@/components/ui/toaster';
import { LogOut } from 'lucide-react';
import { Suspense } from 'react';

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">NFL Confidence Pool</h1>
            <p className="text-gray-600">Welcome, {user?.full_name || user?.email}</p>
          </div>
          <Button onClick={signOut} variant="outline">
            Logout
          </Button>
        </div>

        <PoolDashboard />

        <Tabs defaultValue="picks" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="picks">Make Picks</TabsTrigger>
            <TabsTrigger value="live">Live Games</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="picks" className="mt-6">
            <Suspense fallback={<div>Loading picks...</div>}>
              <WeeklyPick poolId="1" />
            </Suspense>
          </TabsContent>
          <TabsContent value="live" className="mt-6">
            <Suspense fallback={<div>Loading live games...</div>}>
              <LiveGames />
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
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <AdminLogin />;
  }

  return <AuthenticatedApp />;
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

