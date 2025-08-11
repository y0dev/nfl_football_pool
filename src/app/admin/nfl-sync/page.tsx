'use client';

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  syncTeams, 
  syncRegularSeason, 
  syncPlayoffs, 
  syncCurrentWeek, 
  getSyncStatus 
} from '@/actions/syncNFLData';
import { nflAPI } from '@/lib/nfl-api';
import { 
  RefreshCw, 
  Database, 
  Calendar, 
  Trophy, 
  TrendingUp,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

function NFLSyncContent() {
  const { user } = useAuth();
  const [currentSeason, setCurrentSeason] = useState<number>(new Date().getFullYear());
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');

  useEffect(() => {
    if (user?.is_super_admin) {
      loadSyncStatus();
    }
  }, [user, currentSeason]);

  const loadSyncStatus = async () => {
    try {
      const status = await getSyncStatus(currentSeason);
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const handleSyncTeams = async () => {
    setIsLoading(true);
    try {
      const result = await syncTeams(currentSeason);
      if (result.success) {
        setLastSync(new Date().toLocaleString());
        await loadSyncStatus();
      }
      console.log('Teams sync result:', result);
    } catch (error) {
      console.error('Failed to sync teams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncRegularSeason = async () => {
    setIsLoading(true);
    try {
      const result = await syncRegularSeason(currentSeason);
      if (result.success) {
        setLastSync(new Date().toLocaleString());
        await loadSyncStatus();
      }
      console.log('Regular season sync result:', result);
    } catch (error) {
      console.error('Failed to sync regular season:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncPlayoffs = async () => {
    setIsLoading(true);
    try {
      const result = await syncPlayoffs(currentSeason);
      if (result.success) {
        setLastSync(new Date().toLocaleString());
        await loadSyncStatus();
      }
      console.log('Playoffs sync result:', result);
    } catch (error) {
      console.error('Failed to sync playoffs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncCurrentWeek = async () => {
    setIsLoading(true);
    try {
      const result = await syncCurrentWeek(currentSeason);
      if (result.success) {
        setLastSync(new Date().toLocaleString());
        await loadSyncStatus();
      }
      console.log('Current week sync result:', result);
    } catch (error) {
      console.error('Failed to sync current week:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user?.is_super_admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600">You need admin privileges to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">NFL Data Sync</h1>
            <p className="text-gray-600">Manage NFL schedule and game data synchronization</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline">
              Season: {currentSeason}
            </Badge>
            {lastSync && (
              <Badge variant="secondary">
                Last Sync: {lastSync}
              </Badge>
            )}
          </div>
        </div>

        {/* Sync Status */}
        {syncStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                Sync Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {syncStatus.totalGames || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Games</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {syncStatus.finishedGames || 0}
                  </div>
                  <div className="text-sm text-gray-600">Finished Games</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(syncStatus.completionPercentage || 0)}%
                  </div>
                  <div className="text-sm text-gray-600">Completion</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {Object.keys(syncStatus.weekCounts || {}).length}
                  </div>
                  <div className="text-sm text-gray-600">Weeks Loaded</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Sync Teams */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                Sync Teams
              </CardTitle>
              <CardDescription>
                Import all NFL teams for the current season
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleSyncTeams} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Teams
              </Button>
            </CardContent>
          </Card>

          {/* Sync Regular Season */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                Regular Season
              </CardTitle>
              <CardDescription>
                Import all regular season games (Weeks 1-18)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleSyncRegularSeason} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Season
              </Button>
            </CardContent>
          </Card>

          {/* Sync Playoffs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="h-5 w-5" />
                Playoffs
              </CardTitle>
              <CardDescription>
                Import playoff games when available
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleSyncPlayoffs} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Playoffs
              </Button>
            </CardContent>
          </Card>

          {/* Sync Current Week */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5" />
                Current Week
              </CardTitle>
              <CardDescription>
                Update current week games and scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleSyncCurrentWeek} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Current Week
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Initial Setup</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  <li>Sync Teams - Import all NFL teams</li>
                  <li>Sync Regular Season - Import all regular season games</li>
                  <li>Set up your confidence pools</li>
                </ol>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Weekly Maintenance</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  <li>Sync Current Week - Update scores and status</li>
                  <li>Run after each game day</li>
                  <li>Sync Playoffs when regular season ends</li>
                </ol>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Make sure your API key is configured in the environment variables. 
                The sync process may take several minutes for large datasets.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function NFLSyncPage() {
  return (
    <AuthProvider>
      <NFLSyncContent />
    </AuthProvider>
  );
} 