'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Trophy, 
  Mail, 
  Calendar,
  LogOut,
  BarChart3,
  Plus,
  Bell,
  TrendingUp,
  Edit,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminService, DashboardStats, Pool } from '@/lib/admin-service';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { debugLog, createPageUrl } from '@/lib/utils';
import { Game } from '@/types/game';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { CreatePoolDialog } from '@/components/pools/create-pool-dialog';
import { loadWeekGames } from '@/actions/loadWeekGames';

function CommissionerDashboardContent() {
  const { user, signOut, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalPools: 0,
    activePools: 0,
    totalParticipants: 0,
    totalGames: 0,
    pendingSubmissions: 0,
    completedSubmissions: 0
  });
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [poolSelectionOpen, setPoolSelectionOpen] = useState(false);
  const [availablePools, setAvailablePools] = useState<Array<{id: string, name: string}>>([]);
  const [importPicksOpen, setImportPicksOpen] = useState(false);
  const [selectedPoolForImport, setSelectedPoolForImport] = useState<{id: string, name: string} | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [poolSelectionMode, setPoolSelectionMode] = useState<'invite' | 'import'>('invite');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [createPoolDialogOpen, setCreatePoolDialogOpen] = useState(false);
  const [recentActivity, setRecentActivity] = useState<Array<{
    type: 'pool_created' | 'participant_joined' | 'picks_submitted' | 'reminder_sent';
    description: string;
    timestamp: string;
    pool_name?: string;
    participant_name?: string;
  }>>([]);
  const [countdown, setCountdown] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { week, seasonType } = await getUpcomingWeek();
        setCurrentWeek(week);
        setCurrentSeasonType(seasonType);
        
        // Check admin status
        if (user) {
          debugLog('Checking admin status for user:', user.email);
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);
          debugLog('Super admin status:', superAdminStatus);
          
          // Redirect super admins to admin dashboard
          if (superAdminStatus) {
            router.push(createPageUrl('admindashboard'));
            return;
          }
          
          // Only load data for regular admins (commissioners)
          await loadDashboardStats();
          generateNotifications();
          loadRecentActivity();
          await loadGames();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, verifyAdminStatus, router]);

  // Listen for custom event to open create pool dialog
  useEffect(() => {
    const handleOpenCreatePool = () => {
      setCreatePoolDialogOpen(true);
    };

    document.addEventListener('openCreatePoolDialog', handleOpenCreatePool);
    
    return () => {
      document.removeEventListener('openCreatePoolDialog', handleOpenCreatePool);
    };
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (games.length === 0) return;

    const timer = setInterval(() => {
      const firstGame = games[0];
      const gameTime = new Date(firstGame.kickoff_time);
      const now = new Date();
      const timeDiff = gameTime.getTime() - now.getTime();
      
      if (timeDiff <= 0) {
        setCountdown('Games Started');
        return;
      }
      
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
      
      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [games]);

  // Reload games when week or season type changes
  useEffect(() => {
    if (currentWeek && currentSeasonType) {
      loadGames();
    }
  }, [currentWeek, currentSeasonType]);

  const loadDashboardStats = async () => {
    try {
      if (!user?.email) return;
      
      const stats = await adminService.getDashboardStats(
        currentWeek,
        currentSeasonType,
        user.email,
        false // isSuperAdmin = false for commissioners
      );
      
      setDashboardStats(stats);
      
      // Also load available pools for the pool selection
      const pools = await adminService.getActivePools(
        user.email,
        false // isSuperAdmin = false for commissioners
      );
      debugLog('stats pools', pools);
      setAvailablePools(pools);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    }
  };

  const loadGames = async () => {
    try {
      const gamesData = await loadWeekGames(currentWeek, currentSeasonType);
      setGames(gamesData);
      debugLog('Loaded games for countdown:', gamesData.length);
    } catch (error) {
      console.error('Error loading games for countdown:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      if (!user?.email) return;

      // Get real recent activity data from the database
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      const activities = [];
      const now = new Date();
      
      // Get pools created by this commissioner
      const { data: pools } = await supabase
        .from('pools')
        .select('id, name, created_at')
        .eq('created_by', user.email)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (pools) {
        pools.forEach(pool => {
          activities.push({
            type: 'pool_created' as const,
            description: `Created new pool "${pool.name}"`,
            timestamp: pool.created_at,
            pool_name: pool.name
          });
        });
      }
      
      // Get recent participant joins
      const { data: participants } = await supabase
        .from('participants')
        .select('id, name, created_at, pool_id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (participants) {
        // Get pool names for participants
        const poolIds = [...new Set(participants.map(p => p.pool_id))];
        const { data: poolNames } = await supabase
          .from('pools')
          .select('id, name')
          .in('id', poolIds);
        
        const poolNameMap = new Map(poolNames?.map(p => [p.id, p.name]) || []);
        
        participants.forEach(participant => {
          const poolName = poolNameMap.get(participant.pool_id) || 'Unknown Pool';
          activities.push({
            type: 'participant_joined' as const,
            description: `${participant.name || 'New Participant'} joined "${poolName}"`,
            timestamp: participant.created_at,
            participant_name: participant.name || 'New Participant',
            pool_name: poolName
          });
        });
      }
      
      // Get recent picks submissions
      const { data: picks } = await supabase
        .from('picks')
        .select('created_at, participant_id, pool_id')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (picks && picks.length > 0) {
        // Group picks by pool and count submissions
        const poolSubmissions = new Map<string, Set<string>>();
        picks.forEach(pick => {
          if (!poolSubmissions.has(pick.pool_id)) {
            poolSubmissions.set(pick.pool_id, new Set());
          }
          poolSubmissions.get(pick.pool_id)?.add(pick.participant_id);
        });
        
        // Get pool names for picks
        const pickPoolIds = [...new Set(picks.map(p => p.pool_id))];
        const { data: pickPoolNames } = await supabase
          .from('pools')
          .select('id, name')
          .in('id', pickPoolIds);
        
        const pickPoolNameMap = new Map(pickPoolNames?.map(p => [p.id, p.name]) || []);
        
        poolSubmissions.forEach((participants, poolId) => {
          const poolName = pickPoolNameMap.get(poolId) || 'Unknown Pool';
          const participantCount = participants.size;
          if (participantCount > 0) {
            activities.push({
              type: 'picks_submitted' as const,
              description: `${participantCount} participant${participantCount !== 1 ? 's' : ''} submitted picks for "${poolName}"`,
              timestamp: picks.find(p => p.pool_id === poolId)?.created_at || now.toISOString()
            });
          }
        });
      }
      
      // Sort activities by timestamp (most recent first) and take top 5
      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
      
      setRecentActivity(sortedActivities);
      
    } catch (error) {
      console.error('Error loading recent activity:', error);
      // Fallback to empty array if there's an error
      setRecentActivity([]);
    }
  };

  const handlePoolCreated = async () => {
    // Refresh dashboard stats after pool creation
    await loadDashboardStats();
    await loadRecentActivity();
    toast({
      title: 'Pool Created',
      description: 'New pool has been created successfully',
    });
  };

  const generateNotifications = () => {
    const newNotifications: string[] = [];
    
    // Only show notifications if admin has pools to manage
    if (dashboardStats.totalPools === 0) {
      newNotifications.push('You haven\'t created any pools yet. Create your first pool to get started!');
      setNotifications(newNotifications);
      return;
    }
    
    if (dashboardStats.pendingSubmissions > 0) {
      newNotifications.push(`${dashboardStats.pendingSubmissions} participants haven't submitted picks for Week ${currentWeek}`);
    }
    
    if (dashboardStats.totalGames === 0) {
      newNotifications.push('No games scheduled for the current week');
    }
    
    if (dashboardStats.activePools === 0) {
      newNotifications.push('All your pools are currently inactive');
    }
    
    // Add admin-specific notifications
    if (dashboardStats.totalParticipants === 0) {
      newNotifications.push('No participants have joined your pools yet');
    }
    
    if (dashboardStats.completedSubmissions > 0 && dashboardStats.pendingSubmissions === 0) {
      newNotifications.push('All participants have submitted their picks for this week!');
    }
    
    setNotifications(newNotifications);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDashboardStats();
      await loadGames();
      generateNotifications();
      loadRecentActivity();
      setLastRefresh(new Date());
      toast({
        title: 'Dashboard Refreshed',
        description: 'All data has been updated',
      });
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh dashboard data',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      await signOut();
      router.push(createPageUrl('adminlogin'));
    } catch (error) {
      console.error('Error logging out:', error);
      setIsLoggingOut(false);
    }
  };

  const loadCountdown = async () => {
    try {
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      const { data } = await supabase
        .from('seasons')
        .select('picks_close_at')
        .eq('season_type', currentSeasonType)
        .eq('week', currentWeek)
        .single();

      if (data?.picks_close_at) {
        const picksCloseAt = new Date(data.picks_close_at);
        const now = new Date();
        const diffInSeconds = (picksCloseAt.getTime() - now.getTime()) / 1000;

        if (diffInSeconds > 0) {
          setCountdown(`${Math.floor(diffInSeconds / 3600)}h ${Math.floor((diffInSeconds % 3600) / 60)}m`);
        } else {
          setCountdown('Games Started');
        }
      } else {
        setCountdown('Games Started');
      }
    } catch (error) {
      console.error('Error loading countdown:', error);
      setCountdown('Games Started');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50">
      <div className="container mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                <h1 className="text-2xl sm:text-3xl font-bold">Commissioner Dashboard</h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Manage your NFL Confidence Pools and participants
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  Commissioner
                </Badge>
                <Button
                  onClick={handleLogout}
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-2 h-7 sm:h-8 text-xs"
                >
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Logout</span>
                  <span className="sm:hidden">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        
        {/* Countdown Timer */}
        {countdown && countdown !== 'Games Started' && (
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 mb-6 sm:mb-8">
            <CardContent className="p-4">
              <div className="flex items-center justify-center gap-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-900">
                    Picks Close In: {countdown}
                  </div>
                  <div className="text-sm text-blue-700">
                    Make sure participants submit their picks before kickoff
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Games Started Warning */}
        {countdown === 'Games Started' && (
          <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200 mb-6 sm:mb-8">
            <CardContent className="p-4">
              <div className="flex items-center justify-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div className="text-center">
                  <div className="text-lg font-bold text-red-900">
                    Games Have Started!
                  </div>
                  <div className="text-sm text-red-700">
                    All picks are now locked for Week {currentWeek}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Pools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.totalPools}</div>
              <p className="text-xs text-muted-foreground">
                {dashboardStats.activePools} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Participants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.totalParticipants}</div>
              <p className="text-xs text-muted-foreground">
                Across all pools
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{dashboardStats.pendingSubmissions}</div>
              <p className="text-xs text-muted-foreground">
                Need picks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{dashboardStats.completedSubmissions}</div>
              <p className="text-xs text-muted-foreground">
                Picks submitted
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {dashboardStats.totalParticipants > 0 ? Math.round((dashboardStats.completedSubmissions / dashboardStats.totalParticipants) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" />
                Create Pool
              </CardTitle>
              <CardDescription className="text-xs">
                Start a new NFL Confidence Pool
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={() => {
                  const event = new CustomEvent('openCreatePoolDialog');
                  document.dispatchEvent(event);
                }}
                className="w-full"
                size="sm"
              >
                Create Pool
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4" />
                Pool Management
              </CardTitle>
              <CardDescription className="text-xs">
                {isSuperAdmin ? 'Manage all pools and participants' : 'Manage your pools and participants'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={() => router.push(createPageUrl('adminpools'))}
                className="w-full"
                size="sm"
              >
                {isSuperAdmin ? 'Manage All Pools' : 'Manage My Pools'}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Leaderboards
              </CardTitle>
              <CardDescription className="text-xs">
                {isSuperAdmin ? 'View standings for all pools' : 'View standings for your pools'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={() => router.push(createPageUrl('leaderboard'))}
                className="w-full"
                size="sm"
              >
                {isSuperAdmin ? 'View All Leaderboards' : 'View My Leaderboards'}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4" />
                Season Review
              </CardTitle>
              <CardDescription className="text-xs">
                View comprehensive season statistics and achievements
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={() => router.push(createPageUrl('adminpools'))}
                className="w-full"
                size="sm"
                variant="outline"
              >
                Select Pool for Review
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Send Reminders
              </CardTitle>
              <CardDescription className="text-xs">
                Remind participants to submit picks
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={() => router.push(createPageUrl('adminreminders'))}
                className="w-full"
                size="sm"
                disabled={dashboardStats.pendingSubmissions === 0}
              >
                Send Reminders ({dashboardStats.pendingSubmissions})
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Edit className="h-4 w-4" />
                Override Picks
              </CardTitle>
              <CardDescription className="text-xs">
                {isSuperAdmin ? 'Override picks for any pool' : 'Override picks for your pools'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button 
                onClick={() => router.push(createPageUrl('overridepicks'))}
                className="w-full"
                size="sm"
              >
                {isSuperAdmin ? 'Override All Picks' : 'Override My Picks'}
              </Button>
            </CardContent>
          </Card>


        </div>

        {/* Recent Activity */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest updates and notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={index} className={`flex items-center gap-3 p-3 rounded-lg ${
                    activity.type === 'pool_created' ? 'bg-green-50' :
                    activity.type === 'participant_joined' ? 'bg-blue-50' :
                    activity.type === 'picks_submitted' ? 'bg-purple-50' :
                    'bg-gray-50'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      activity.type === 'pool_created' ? 'bg-green-500' :
                      activity.type === 'participant_joined' ? 'bg-blue-500' :
                      activity.type === 'picks_submitted' ? 'bg-purple-500' :
                      'bg-gray-500'
                    }`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.description}</p>
                      <p className="text-xs text-gray-600">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Role Information - Only visible in development */}
        {process.env.NODE_ENV === 'development' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Your Commissioner Access
              </CardTitle>
              <CardDescription>
                Current permissions and pool access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Role:</span>
                  <Badge variant="outline">
                    Commissioner
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="font-medium">Pool Access:</span>
                  <span className="text-sm text-gray-600">
                    {dashboardStats.totalPools} pools
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-medium">Status:</span>
                  <Badge variant="default">
                    Active
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-medium">Last Activity:</span>
                  <span className="text-sm text-gray-600">
                    {lastRefresh.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Pool Dialog */}
        <CreatePoolDialog 
          open={createPoolDialogOpen} 
          onOpenChange={setCreatePoolDialogOpen}
          onPoolCreated={handlePoolCreated}
        />
      </div>
    </div>
  );
}

export default function CommissionerDashboard() {
  return (
    <AuthProvider>
      <AdminGuard>
        <CommissionerDashboardContent />
      </AdminGuard>
    </AuthProvider>
  );
}
