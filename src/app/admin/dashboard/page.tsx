'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PoolDashboard } from '@/components/pools/pool-dashboard';
import { ParticipantManagement } from '@/components/admin/participant-management';
import { SubmissionsScreenshot } from '@/components/admin/submissions-screenshot';
import { TieBreakerSettings } from '@/components/admin/tie-breaker-settings';
import { EmailManagement } from '@/components/admin/email-management';
import { SubmissionStatus } from '@/components/admin/submission-status';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';

export default function AdminDashboard() {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedPool, setSelectedPool] = useState({ id: '1', name: 'Test Pool' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || 1);
      } catch (error) {
        console.error('Error loading current week:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600">Manage your NFL Confidence Pool</p>
      </div>

      <PoolDashboard />

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="tiebreakers">Tie-Breakers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SubmissionStatus poolId={selectedPool.id} />
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
          <EmailManagement 
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

        <TabsContent value="tiebreakers" className="space-y-6">
          <TieBreakerSettings 
            poolId={selectedPool.id} 
            poolName={selectedPool.name}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
} 