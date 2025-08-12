'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { WeeklyPick } from '@/components/picks/weekly-pick';
import { Leaderboard } from '@/components/leaderboard/leaderboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trophy, Users, Calendar } from 'lucide-react';
import Link from 'next/link';
import { loadPools } from '@/actions/loadPools';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';

function ParticipantContent() {
  const searchParams = useSearchParams();
  const poolId = searchParams.get('pool');
  const weekParam = searchParams.get('week');
  
  const [poolName, setPoolName] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load current week if not provided in URL or if week parameter is empty
        if (!weekParam || weekParam === '') {
          const weekData = await loadCurrentWeek();
          setCurrentWeek(weekData.week_number);
          // Show a helpful message for empty week parameter
          toast({
            title: "Week not specified",
            description: `Showing current week (Week ${weekData.week_number})`,
            duration: 3000,
          });
        } else {
          const weekNumber = parseInt(weekParam);
          if (isNaN(weekNumber) || weekNumber < 1) {
            // Invalid week number, use current week
            const weekData = await loadCurrentWeek();
            setCurrentWeek(weekData.week_number);
            toast({
              title: "Invalid week number",
              description: `Showing current week (Week ${weekData.week_number}) instead`,
              duration: 3000,
            });
          } else {
            setCurrentWeek(weekNumber);
          }
        }

        // Load pool information
        if (poolId) {
          const pools = await loadPools();
          const pool = pools.find(p => p.id === poolId);
          if (pool) {
            setPoolName(pool.name);
          } else {
            setError('Pool not found. Please check the pool link.');
          }
        } else {
          setError('Pool ID is required. Please use a valid pool link.');
        }
              } catch (error) {
          console.error('Error loading participant data:', error);
          setError('Failed to load pool information. Please try again or contact the pool administrator.');
        } finally {
          setIsLoading(false);
        }
    };

    loadData();
  }, [poolId, weekParam]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Floating Back Button for Mobile */}
      <div className="fixed top-4 left-4 z-50 sm:hidden">
        <Link href="/">
          <Button variant="outline" size="sm" className="shadow-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Home</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl sm:text-2xl font-bold">NFL Confidence Pool</h1>
              </div>
            </div>
          </div>
          
          {/* Pool Info */}
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold text-lg">{poolName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <Badge variant="outline">Week {currentWeek}</Badge>
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                <p>Welcome to the pool!</p>
                <p>Make your picks below to participate.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="picks" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="picks">Make Picks</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="picks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Week {currentWeek} Picks</CardTitle>
                <CardDescription>
                  Select the winner for each game and assign confidence points
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WeeklyPick poolId={poolId!} weekNumber={currentWeek} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>
                  Current standings for Week {currentWeek}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Leaderboard />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function ParticipantPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <ParticipantContent />
    </Suspense>
  );
}
