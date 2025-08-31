'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Calendar,
  Clock,
  Trophy,
  Activity,
  Database,
  Globe,
  Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { debugLog } from '@/lib/utils';

interface SyncResult {
  success: boolean;
  message: string;
  gamesProcessed: number;
  gamesUpdated: number;
  gamesFailed: number;
  failedGameDetails?: Array<{
    gameId: string;
    error: string;
  }>;
  seasonType: number;
  week: number;
  year: number;
  endpoint: string;
  timestamp?: string;
}

interface SyncHistory {
  id: string;
  timestamp: string;
  result: SyncResult;
}

function NFLSyncContent() {
  const { user, signOut, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [showSyncPopup, setShowSyncPopup] = useState(false);
  const [currentStats, setCurrentStats] = useState({
    totalGames: 0,
    liveGames: 0,
    completedGames: 0,
    scheduledGames: 0
  });
  const [upcomingSync, setUpcomingSync] = useState({
    week: 1,
    seasonType: 2,
    year: new Date().getFullYear(),
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check admin status
        if (user) {
          debugLog('Checking admin status for user:', user.email);
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);
          debugLog('Super admin status:', superAdminStatus);
          
          // Redirect commissioners to their dashboard
          if (!superAdminStatus) {
            router.push('/dashboard');
            return;
          }
          
          if (superAdminStatus) {
            await loadCurrentStats();
            loadSyncHistory();
            // Load upcoming sync information
            const syncInfo = getUpcomingSyncInfo();
            setUpcomingSync(syncInfo);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, verifyAdminStatus, router]);

  const getUpcomingSyncInfo = () => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    let seasonType = 2; // Default to regular season
    let week = 1;
    
    // Determine season type and week based on current date
    if (month === 8) {
      seasonType = 1; // Preseason
      week = Math.max(1, Math.min(4, Math.floor(currentDate.getDate() / 7) + 1));
    } else if (month >= 9 && month <= 12) {
      seasonType = 2; // Regular season
      week = Math.max(1, Math.min(18, Math.floor((month - 9) * 4) + Math.floor(currentDate.getDate() / 7)));
    } else if (month >= 1 && month <= 2) {
      seasonType = 3; // Postseason
      week = Math.max(1, Math.min(5, Math.floor((month - 1) * 4) + Math.floor(currentDate.getDate() / 7)));
    }

    return { week, seasonType, year };
  };

  const loadCurrentStats = async () => {
    try {
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      // Get current game statistics
      const { data: games, error } = await supabase
        .from('games')
        .select('status')
        .eq('season', new Date().getFullYear());
      
      if (error) throw error;
      
      const stats = {
        totalGames: games?.length || 0,
        liveGames: games?.filter(g => g.status === 'live').length || 0,
        completedGames: games?.filter(g => g.status === 'final').length || 0,
        scheduledGames: games?.filter(g => g.status === 'scheduled').length || 0
      };
      
      setCurrentStats(stats);
      
    } catch (error) {
      console.error('Error loading current stats:', error);
    }
  };

  const loadSyncHistory = () => {
    // Load sync history from localStorage
    try {
      const history = localStorage.getItem('nfl-sync-history');
      if (history) {
        setSyncHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Error loading sync history:', error);
    }
  };

  const saveSyncHistory = (result: SyncResult) => {
    try {
      const historyItem: SyncHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        result
      };
      
      const newHistory = [historyItem, ...syncHistory.slice(0, 9)]; // Keep last 10
      setSyncHistory(newHistory);
      localStorage.setItem('nfl-sync-history', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving sync history:', error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    
    try {
      const response = await fetch('/api/admin/nfl-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: SyncResult = await response.json();

      if (result.success) {
        setLastSyncResult(result);
        saveSyncHistory(result);
        
        // Show success popup
        setShowSyncPopup(true);
        
        toast({
          title: 'Sync Successful',
          description: `Updated ${result.gamesUpdated} games successfully`,
        });
        
        // Refresh current stats
        await loadCurrentStats();
        
      } else {
        // Show error popup
        setLastSyncResult(result);
        setShowSyncPopup(true);
        
        toast({
          title: 'Sync Failed',
          description: result.message || 'Failed to sync NFL data',
          variant: 'destructive',
        });
      }
      
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: 'Sync Error',
        description: 'Failed to connect to sync service',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      await signOut();
      router.push('/admin/login');
    } catch (error) {
      console.error('Error logging out:', error);
      setIsLoggingOut(false);
    }
  };

  const getSeasonTypeLabel = (type: number) => {
    switch (type) {
      case 1: return 'Preseason';
      case 2: return 'Regular Season';
      case 3: return 'Postseason';
      default: return 'Unknown';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'live': return 'destructive';
      case 'final': return 'default';
      case 'scheduled': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/admin/dashboard')}
                  className="p-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Globe className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <h1 className="text-2xl sm:text-3xl font-bold">NFL Data Sync</h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Synchronize NFL game data from RapidAPI to keep your pools up to date
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  System Admin
                </Badge>
                <Button
                  onClick={handleLogout}
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-2 h-7 sm:h-8 text-xs"
                >
                  <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Logout</span>
                  <span className="sm:hidden">Logout</span>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </div>
        </div>

        {/* Upcoming Sync Information */}
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Calendar className="h-5 w-5" />
              Upcoming Sync
            </CardTitle>
            <CardDescription className="text-blue-700">
              Week and season that will be synchronized
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{upcomingSync.week}</div>
                <div className="text-sm text-blue-700">Week</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-indigo-600">
                  {getSeasonTypeLabel(upcomingSync.seasonType)}
                </div>
                <div className="text-sm text-indigo-700">Season Type</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-purple-600">{upcomingSync.year}</div>
                <div className="text-sm text-purple-700">Season Year</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-100 rounded-lg">
              <div className="text-sm text-blue-800 text-center">
                <strong>Next sync will update:</strong> Week {upcomingSync.week} of {getSeasonTypeLabel(upcomingSync.seasonType)} {upcomingSync.year}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Games</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentStats.totalGames}</div>
              <p className="text-xs text-muted-foreground">
                In current season
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Live Games</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{currentStats.liveGames}</div>
              <p className="text-xs text-muted-foreground">
                Currently playing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{currentStats.completedGames}</div>
              <p className="text-xs text-muted-foreground">
                Final scores
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{currentStats.scheduledGames}</div>
              <p className="text-xs text-muted-foreground">
                Upcoming games
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Last Sync Result */}
        {lastSyncResult && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Last Sync Result
              </CardTitle>
              <CardDescription>
                Results from the most recent synchronization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{lastSyncResult.gamesProcessed}</div>
                  <div className="text-sm text-green-700">Games Processed</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{lastSyncResult.gamesUpdated}</div>
                  <div className="text-sm text-blue-700">Successfully Updated</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{lastSyncResult.gamesFailed}</div>
                  <div className="text-sm text-red-700">Failed Updates</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {getSeasonTypeLabel(lastSyncResult.seasonType)}
                  </div>
                  <div className="text-sm text-purple-700">Week {lastSyncResult.week}</div>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>Season: {lastSyncResult.year}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span>Endpoint: {lastSyncResult.endpoint}</span>
                </div>
                {lastSyncResult.failedGameDetails && lastSyncResult.failedGameDetails.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">Failed Game Details:</h4>
                    <div className="space-y-1 text-xs text-red-700">
                      {lastSyncResult.failedGameDetails.slice(0, 5).map((detail, index) => (
                        <div key={index}>
                          Game ID: {detail.gameId} - {detail.error}
                        </div>
                      ))}
                      {lastSyncResult.failedGameDetails.length > 5 && (
                        <div className="text-red-600">
                          ...and {lastSyncResult.failedGameDetails.length - 5} more failures
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync History */}
        {syncHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Sync History
              </CardTitle>
              <CardDescription>
                Recent synchronization attempts and results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {syncHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {item.result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <div>
                        <div className="font-medium">
                          {item.result.success ? 'Sync Successful' : 'Sync Failed'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">
                        {item.result.gamesUpdated} updated
                      </div>
                      <div className="text-gray-600">
                        {item.result.gamesFailed} failed
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Information Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              About NFL Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-medium">Data Source</div>
                  <div>NFL game data is fetched from RapidAPI&apos;s American Football API, providing real-time scores, schedules, and game status updates.</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <RefreshCw className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium">Automatic Updates</div>
                  <div>Games are updated in batches of 50 to prevent rate limiting. The system processes preseason, regular season, and postseason games.</div>
                </div>
              </div>
              
                              <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <div className="font-medium">Team Names</div>
                    <div>Team names are stored exactly as received from the NFL API without normalization (e.g., &quot;Kansas City Chiefs&quot; remains &quot;Kansas City Chiefs&quot;).</div>
                  </div>
                </div>
              
              <div className="flex items-start gap-3">
                <Trophy className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <div className="font-medium">Pool Integration</div>
                  <div>Updated game data automatically affects all active pools, ensuring accurate scoring and leaderboard calculations.</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Results Popup */}
        <Dialog open={showSyncPopup} onOpenChange={setShowSyncPopup}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {lastSyncResult?.success ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Sync Completed Successfully
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    Sync Failed
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {lastSyncResult?.success 
                  ? 'NFL data synchronization has been completed. Here are the results:'
                  : 'NFL data synchronization encountered an error. Here are the details:'
                }
              </DialogDescription>
            </DialogHeader>
            
            {lastSyncResult && (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{lastSyncResult.gamesProcessed}</div>
                    <div className="text-sm text-blue-700">Games Processed</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{lastSyncResult.gamesUpdated}</div>
                    <div className="text-sm text-green-700">Successfully Updated</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{lastSyncResult.gamesFailed}</div>
                    <div className="text-sm text-red-700">Failed Updates</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {getSeasonTypeLabel(lastSyncResult.seasonType)}
                    </div>
                    <div className="text-sm text-purple-700">Week {lastSyncResult.week}</div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span><strong>Season:</strong> {lastSyncResult.year}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span><strong>Week:</strong> {lastSyncResult.week}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-gray-500" />
                      <span><strong>Season Type:</strong> {getSeasonTypeLabel(lastSyncResult.seasonType)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <span><strong>API Endpoint:</strong> {lastSyncResult.endpoint}</span>
                    </div>
                  </div>

                  {/* Failed Game Details */}
                  {lastSyncResult.failedGameDetails && lastSyncResult.failedGameDetails.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="font-medium text-red-800 mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Failed Game Details ({lastSyncResult.failedGameDetails.length} failures)
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {lastSyncResult.failedGameDetails.map((detail, index) => (
                          <div key={index} className="text-xs text-red-700 p-2 bg-red-100 rounded border">
                            <div><strong>Game ID:</strong> {detail.gameId}</div>
                            <div><strong>Error:</strong> {detail.error}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Success Message */}
                  {lastSyncResult.success && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-800">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">
                          {lastSyncResult.gamesUpdated > 0 
                            ? `Successfully synchronized ${lastSyncResult.gamesUpdated} NFL games!`
                            : 'No new games to update at this time.'
                          }
                        </span>
                      </div>
                      <p className="text-sm text-green-700 mt-2">
                        Your pools will now have the most up-to-date game information including scores, 
                        game status, and winner determinations.
                      </p>
                    </div>
                  )}

                  {/* Error Message */}
                  {!lastSyncResult.success && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 text-red-800">
                        <XCircle className="h-5 w-5" />
                        <span className="font-medium">Synchronization failed</span>
                      </div>
                      <p className="text-sm text-red-700 mt-2">
                        {lastSyncResult.message || 'An unexpected error occurred during synchronization.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                onClick={() => setShowSyncPopup(false)}
                className="w-full sm:w-auto"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default function NFLSyncPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <NFLSyncContent />
      </AdminGuard>
    </AuthProvider>
  );
} 