'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Users, 
  Trophy, 
  Settings, 
  BarChart3, 
  Mail, 
  Calendar,
  LogOut,
  Activity,
  Clock,
  TrendingUp,
  Plus,
  Zap,
  Bell,
  RefreshCw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminService, DashboardStats, Pool, Admin } from '@/lib/admin-service';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { debugLog, createPageUrl } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { CreatePoolDialog } from '@/components/pools/create-pool-dialog';

function AdminDashboardContent() {
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
  const [lastGameUpdate, setLastGameUpdate] = useState<Date | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [createPoolDialogOpen, setCreatePoolDialogOpen] = useState(false);

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
          
          // Redirect commissioners to their dashboard
          if (!superAdminStatus) {
            router.push(createPageUrl('dashboard'));
            return;
          }
          
          if (superAdminStatus) {
            debugLog('Loading admins...');
            await loadAdmins();
            debugLog('Admins loaded');
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

  useEffect(() => {
    if (currentWeek && currentSeasonType && isSuperAdmin !== undefined) {
      loadDashboardStats();
      loadLastGameUpdate();
      generateNotifications();
    }
  }, [currentWeek, currentSeasonType, isSuperAdmin]);

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

  const loadDashboardStats = async () => {
    try {
      if (!user?.email) return;
      
      const stats = await adminService.getDashboardStats(
        currentWeek,
        currentSeasonType,
        user.email,
        true // isSuperAdmin = true for admin dashboard
      );
      
      setDashboardStats(stats);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    }
  };

  const loadLastGameUpdate = async () => {
    try {
      const response = await fetch('/api/games?action=last-update');
      
      if (!response.ok) {
        console.error('Error fetching last game update:', response.statusText);
        return;
      }
      
      const data = await response.json();
      debugLog('Last Game Update - API Response: ', data);
      
      if (data.success && data.lastUpdate) {
        setLastGameUpdate(new Date(data.lastUpdate));
      }
    } catch (error) {
      console.error('Error loading last game update:', error);
    }
  };

  const loadAdmins = async () => {
    debugLog('Function: loadAdmins - Loading admins...');
    
    try {
      const adminsData = await adminService.getAdmins();
      debugLog('adminsData', adminsData);
      setAdmins(adminsData);
    } catch (error) {
      console.error('Error loading admins:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admin data',
        variant: 'destructive',
      });
    }
  };

  const generateNotifications = () => {
    const newNotifications: string[] = [];
    
    if (dashboardStats.totalPools === 0) {
      newNotifications.push('No active pools found in the system. Create a pool to get started!');
      setNotifications(newNotifications);
      return;
    }
    
    if (dashboardStats.pendingSubmissions > 0) {
      newNotifications.push(`${dashboardStats.pendingSubmissions} participants across all pools haven't submitted picks for Week ${currentWeek}`);
    }
    
    if (dashboardStats.totalGames === 0) {
      newNotifications.push('No games scheduled for the current week');
    }
    
    if (dashboardStats.activePools === 0) {
      newNotifications.push('All pools in the system are currently inactive');
    }
    
    if (dashboardStats.totalParticipants === 0) {
      newNotifications.push('No participants have joined any pools yet');
    }
    
    if (dashboardStats.completedSubmissions > 0 && dashboardStats.pendingSubmissions === 0) {
      newNotifications.push('All participants across all pools have submitted their picks for this week!');
    }
    
    setNotifications(newNotifications);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDashboardStats();
      await loadLastGameUpdate();
      generateNotifications();
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

  const handlePoolCreated = async () => {
    // Refresh dashboard stats after pool creation
    await loadDashboardStats();
    toast({
      title: 'Pool Created',
      description: 'New pool has been created successfully',
    });
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
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <h1 className="text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                System-wide administrative control
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
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Logout</span>
                  <span className="sm:hidden">Logout</span>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 h-8 sm:h-9 text-xs sm:text-sm"
              >
                <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                <span className="sm:hidden">{isRefreshing ? '...' : 'Refresh'}</span>
              </Button>
              <Button
                onClick={() => setShowNotifications(!showNotifications)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 relative h-8 sm:h-9 text-xs sm:text-sm"
              >
                <Bell className="h-3 w-3 sm:h-4 sm:w-4" />
                {notifications.length > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Notifications Panel */}
        {showNotifications && notifications.length > 0 && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-900 text-sm sm:text-base">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {notifications.map((notification, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs sm:text-sm text-orange-800">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-orange-500 rounded-full flex-shrink-0"></div>
                    <span className="break-words">{notification}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
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
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {admins.filter(admin => admin.is_super_admin).length}
              </div>
              <p className="text-xs text-muted-foreground">
                System administrators
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Commissioners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {admins.filter(admin => !admin.is_super_admin).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Pool managers
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                Manage Commissioners
              </CardTitle>
              <CardDescription>
                Create and manage commissioner accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push(createPageUrl('admincommissioners'))}
                className="w-full"
              >
                Manage Commissioners
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5" />
                Pool Management
              </CardTitle>
              <CardDescription>
                Manage pools and participants
              </CardDescription>
            </CardHeader>
            <CardContent>
                             <Button 
                 onClick={() => router.push(createPageUrl('adminpools'))}
                 className="w-full"
               >
                 Manage Pools
               </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5" />
                Email Management
              </CardTitle>
              <CardDescription>
                Send emails and manage communications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push(createPageUrl('adminreminders'))}
                className="w-full"
              >
                Email Management
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                NFL Sync
              </CardTitle>
              <CardDescription>
                Synchronize NFL data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push(createPageUrl('adminnflsync'))}
                className="w-full"
              >
                NFL Sync
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Override Picks
              </CardTitle>
              <CardDescription>
                Override participant picks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push(createPageUrl('adminoverridepicks'))}
                className="w-full"
              >
                Override Picks
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="h-5 w-5" />
                Create Pool
              </CardTitle>
              <CardDescription>
                Create a new confidence pool
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => {
                  const event = new CustomEvent('openCreatePoolDialog');
                  document.dispatchEvent(event);
                }}
                className="w-full"
              >
                Create Pool
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Current Week Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Current Week Information
            </CardTitle>
            <CardDescription>
              Week {currentWeek} - {currentSeasonType === 1 ? 'Preseason' : currentSeasonType === 2 ? 'Regular Season' : 'Postseason'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{dashboardStats.totalGames}</div>
                <div className="text-sm text-gray-600">Games Scheduled</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{dashboardStats.pendingSubmissions}</div>
                <div className="text-sm text-gray-600">Pending Submissions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{dashboardStats.completedSubmissions}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {lastGameUpdate ? lastGameUpdate.toLocaleTimeString() : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Last Game Update</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Your Role Information
            </CardTitle>
            <CardDescription>
              Current permissions and access levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Primary Role:</span>
                <Badge variant="outline">
                  System Admin
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium">Global Permissions:</span>
                <span className="text-sm text-gray-600">
                  Full system access
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-medium">Pool Access:</span>
                <span className="text-sm text-gray-600">
                  All pools ({dashboardStats.totalPools})
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-medium">Status:</span>
                <Badge variant="default">
                  Active
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-medium">Last Game Update:</span>
                <span className="text-sm text-gray-600">
                  {lastGameUpdate ? lastGameUpdate.toLocaleString() : 'Never'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-medium">Last Dashboard Refresh:</span>
                <span className="text-sm text-gray-600">
                  {lastRefresh.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Pool Dialog */}
      <CreatePoolDialog 
        open={createPoolDialogOpen} 
        onOpenChange={setCreatePoolDialogOpen}
        onPoolCreated={handlePoolCreated}
      />
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <AdminDashboardContent />
      </AdminGuard>
    </AuthProvider>
  );
} 