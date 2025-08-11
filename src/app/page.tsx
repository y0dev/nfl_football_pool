'use client';

import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { UserSelection } from '@/components/auth/user-selection';
import { AdminLogin } from '@/components/auth/auth-form';
import { PoolDashboard } from '@/components/pools/pool-dashboard';
import { WeeklyPicks } from '@/components/picks/weekly-pick';
import { Leaderboard } from '@/components/leaderboard/leaderboard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/toaster';
import { LogOut, Trophy } from 'lucide-react';

function AuthenticatedApp() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <Trophy className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">NFL Confidence Pool</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.name || user?.email}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="pools" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pools">My Pools</TabsTrigger>
            <TabsTrigger value="picks">Make Picks</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>
          <TabsContent value="pools" className="mt-6">
            <PoolDashboard />
          </TabsContent>
          <TabsContent value="picks" className="mt-6">
            <WeeklyPicks />
          </TabsContent>
          <TabsContent value="leaderboard" className="mt-6">
            <Leaderboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function UnauthenticatedApp() {
  const [authMode, setAuthMode] = useState<'user' | 'admin'>('user');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <Trophy className="h-12 w-12 text-blue-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">NFL Confidence Pool</h1>
        <p className="text-gray-600">Make your picks, rank your confidence, win prizes!</p>
      </div>

      <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as 'user' | 'admin')} className="w-full max-w-md">
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
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Trophy className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedApp /> : <UnauthenticatedApp />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}
export default App;

