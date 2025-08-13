'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PoolDashboard } from '@/components/pools/pool-dashboard';
import { ParticipantManagement } from '@/components/admin/participant-management';
import { SubmissionsScreenshot } from '@/components/admin/submissions-screenshot';
import { TieBreakerSettings } from '@/components/admin/tie-breaker-settings';
import { EmailManagement } from '@/components/admin/email-management';
import { EnhancedEmailManagement } from '@/components/admin/enhanced-email-management';
import { SubmissionStatus } from '@/components/admin/submission-status';
import { ParticipantLinks } from '@/components/admin/participant-links';
import { TestPicks } from '@/components/admin/test-picks';
import { PoolSettings } from '@/components/admin/pool-settings';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { loadPools } from '@/actions/loadPools';
import { AuthProvider } from '@/lib/auth';

export default function AdminDashboard() {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedPool, setSelectedPool] = useState<any>(null);
  const [pools, setPools] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || 1);
        
        // Load pools
        const poolsData = await loadPools();
        setPools(poolsData);
        
        // Select the first pool if available
        if (poolsData && poolsData.length > 0) {
          setSelectedPool(poolsData[0]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
    return (
      <AuthProvider>
        <div className="container mx-auto p-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600">Manage your NFL Confidence Pool</p>
        </div>

        <PoolDashboard />

        {/* Pool Selector */}
        {pools.length > 0 && (
          <div className="my-6 p-4 bg-white rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Selected Pool</h3>
                <p className="text-sm text-gray-600">
                  {selectedPool ? selectedPool.name : 'No pool selected'}
                </p>
              </div>
              <select
                value={selectedPool?.id || ''}
                onChange={(e) => {
                  const pool = pools.find(p => p.id === e.target.value);
                  setSelectedPool(pool || null);
                }}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a pool...</option>
                {pools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {!selectedPool ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pool Selected</h3>
            <p className="text-gray-600">Please select a pool to view its details and manage participants.</p>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="test-picks" className="text-xs sm:text-sm">Test Picks</TabsTrigger>
            <TabsTrigger value="links" className="text-xs sm:text-sm">Links</TabsTrigger>
            <TabsTrigger value="participants" className="text-xs sm:text-sm">Participants</TabsTrigger>
            <TabsTrigger value="submissions" className="text-xs sm:text-sm">Submissions</TabsTrigger>
            <TabsTrigger value="emails" className="text-xs sm:text-sm">Emails</TabsTrigger>
            <TabsTrigger value="scores" className="text-xs sm:text-sm">Scores</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
            <TabsTrigger value="tiebreakers" className="text-xs sm:text-sm">Tie-Breakers</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <SubmissionStatus poolId={selectedPool.id} />
          </TabsContent>

          <TabsContent value="test-picks" className="space-y-6">
            <TestPicks 
              poolId={selectedPool.id} 
              poolName={selectedPool.name}
            />
          </TabsContent>

          <TabsContent value="links" className="space-y-6">
            <ParticipantLinks 
              poolId={selectedPool.id} 
              poolName={selectedPool.name}
            />
          </TabsContent>

          <TabsContent value="participants" className="space-y-6">
            <ParticipantManagement 
              poolId={selectedPool.id} 
              poolName={selectedPool.name}
            />
          </TabsContent>

          <TabsContent value="submissions" className="space-y-6">
            <SubmissionsScreenshot 
              poolId={selectedPool.id} 
              poolName={selectedPool.name}
              week={currentWeek}
            />
          </TabsContent>

          <TabsContent value="emails" className="space-y-6">
            <EnhancedEmailManagement 
              poolId={selectedPool.id}
              weekNumber={currentWeek}
              adminId="1" // This should be dynamic based on logged in admin
              poolName={selectedPool.name}
            />
          </TabsContent>

          <TabsContent value="scores" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Scores</CardTitle>
                <CardDescription>View and manage weekly scores</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">Score management features coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <PoolSettings 
              poolId={selectedPool.id} 
              poolName={selectedPool.name}
            />
          </TabsContent>

          <TabsContent value="tiebreakers" className="space-y-6">
            <TieBreakerSettings 
              poolId={selectedPool.id} 
              poolName={selectedPool.name}
            />
          </TabsContent>
        </Tabs>
        )}
      </div>
    </AuthProvider>
  );
} 