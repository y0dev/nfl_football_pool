'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trophy, Users, Calendar } from 'lucide-react';
import Link from 'next/link';
import { Leaderboard } from '@/components/leaderboard/leaderboard';

export default function LeaderboardPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Home</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl sm:text-2xl font-bold">NFL Confidence Pool Leaderboards</h1>
            </div>
          </div>
          
          {/* Info Card */}
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold text-lg">Pool Standings</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    View current standings for all active pools
                  </span>
                </div>
              </div>
              
              <div className="text-sm text-gray-600 text-center sm:text-right">
                <p>Select a pool below to view the leaderboard</p>
                <p>Choose any week to see historical results</p>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard Component */}
        <Card>
          <CardHeader>
            <CardTitle>Pool Leaderboards</CardTitle>
            <CardDescription>
              Select a pool and week to view the current standings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Leaderboard />
          </CardContent>
        </Card>

        {/* Additional Info */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How to Play</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Pick the winner of each NFL game</p>
                <p>• Assign confidence points (1-16) to each pick</p>
                <p>• Higher confidence = more points if correct</p>
                <p>• Most points at the end wins!</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scoring System</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Correct pick = confidence points earned</p>
                <p>• Wrong pick = 0 points</p>
                <p>• Each confidence point can only be used once</p>
                <p>• Ties are broken by total correct picks</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
