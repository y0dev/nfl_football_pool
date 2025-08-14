'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PoolDashboard } from '@/components/pools/pool-dashboard';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LogOut, Users, Trophy, Calendar, Clock, TrendingUp, Activity, Settings, Plus, BarChart3, Mail, Share2, RefreshCw, Bell, Zap, Shield, Key } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Admin {
  id: string;
  email: string;
  full_name: string | null;
  is_super_admin: boolean;
  is_active: boolean;
  created_at: string;
}

function AdminDashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2); // Default to regular season
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
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
  const [adminManagementOpen, setAdminManagementOpen] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || 1);
        setCurrentSeasonType(weekData?.season_type || 2);
        await loadDashboardStats();
        generateNotifications();
        if (user?.is_super_admin) {
          await loadAdmins();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  useEffect(() => {
    if (currentWeek && currentSeasonType) {
      loadDashboardStats();
      generateNotifications();
    }
  }, [currentWeek, currentSeasonType]);

  const loadDashboardStats = async () => {
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      // Get pool stats - filter by admin
      let poolsQuery = supabase.from('pools').select('id, is_active');
      
      // If not super admin, only show pools created by this admin
      if (!user?.is_super_admin) {
        poolsQuery = poolsQuery.eq('created_by', user?.email || '');
      }
      
      const { data: pools } = await poolsQuery;
      
      // Get participant stats - filter by admin's pools
      let participantsQuery = supabase
        .from('participants')
        .select('id, is_active, pool_id');
      
      if (!user?.is_super_admin && pools) {
        const poolIds = pools.map(p => p.id);
        participantsQuery = participantsQuery.in('pool_id', poolIds);
      }
      
      const { data: participants } = await participantsQuery;
      
      // Get game stats for current week and season type
      const { data: games } = await supabase
        .from('games')
        .select('id, week, season_type')
        .eq('week', currentWeek)
        .eq('season_type', currentSeasonType);
      
      // Get submission stats - filter by admin's pools
      let picksQuery = supabase
        .from('picks')
        .select('participant_id, pool_id, games!inner(week, season_type)')
        .eq('games.week', currentWeek)
        .eq('games.season_type', currentSeasonType);
      
      if (!user?.is_super_admin && pools) {
        const poolIds = pools.map(p => p.id);
        picksQuery = picksQuery.in('pool_id', poolIds);
      }
      
      const { data: picks } = await picksQuery;
      
      const totalPools = pools?.length || 0;
      const activePools = pools?.filter(p => p.is_active).length || 0;
      const totalParticipants = participants?.filter(p => p.is_active).length || 0;
      const totalGames = games?.length || 0;
      const completedSubmissions = new Set(picks?.map(p => p.participant_id)).size;
      const pendingSubmissions = totalParticipants - completedSubmissions;
      
      setDashboardStats({
        totalPools,
        activePools,
        totalParticipants,
        totalGames,
        pendingSubmissions,
        completedSubmissions
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const loadAdmins = async () => {
    if (!user?.is_super_admin) return;
    
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      const { data: adminsData, error } = await supabase
        .from('admins')
        .select('id, email, full_name, is_super_admin, is_active, created_at')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading admins:', error);
        return;
      }
      
      setAdmins(adminsData || []);
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  };

  const resetAdminPassword = async () => {
    if (!resetEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an admin email address',
        variant: 'destructive',
      });
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resetEmail }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Password Reset',
          description: `Password reset email sent to ${resetEmail}`,
        });
        setResetEmail('');
        setAdminManagementOpen(false);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to reset password',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset password',
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const generateNotifications = () => {
    const newNotifications: string[] = [];
    
    // Only show notifications if admin has pools
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

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'create-pool':
        // Trigger the create pool dialog by dispatching a custom event
        const event = new CustomEvent('openCreatePoolDialog');
        document.dispatchEvent(event);
        break;
      case 'view-leaderboard':
        if (dashboardStats.totalPools > 0) {
          router.push('/admin/leaderboard');
        } else {
          toast({
            title: 'No Pools',
            description: 'Create a pool first to view leaderboards',
            variant: 'destructive',
          });
        }
        break;
      case 'send-reminders':
        if (dashboardStats.pendingSubmissions > 0) {
          router.push('/admin/pools');
          toast({
            title: 'Send Reminders',
            description: 'Navigate to a specific pool to send email reminders to participants who haven\'t submitted',
          });
        } else {
          toast({
            title: 'No Reminders Needed',
            description: 'All participants have submitted their picks!',
          });
        }
        break;
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      router.push('/admin/login');
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
              {user?.is_super_admin ? 'Admin Dashboard' : 'My Dashboard'}
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              {user?.is_super_admin 
                ? 'Manage all NFL Confidence Pools' 
                : 'Manage your NFL Confidence Pools'
              }
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
        {user?.is_super_admin && (
                <Badge variant="outline" className="text-xs">
            Super Admin
          </Badge>
        )}
              {!user?.is_super_admin && (
                <Badge variant="secondary" className="text-xs">
                  Pool Admin
                </Badge>
              )}
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
            <Button
              onClick={handleLogout}
              disabled={isLoggingOut}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 h-8 sm:h-9 text-xs sm:text-sm"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
              <span className="sm:hidden">{isLoggingOut ? '...' : 'Logout'}</span>
            </Button>
          </div>
      </div>

        {/* Notifications Panel */}
        {showNotifications && notifications.length > 0 && (
          <Card className="mb-4 border-orange-200 bg-orange-50">
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mx-auto mb-2" />
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{dashboardStats.totalPools}</div>
              <div className="text-xs sm:text-sm text-gray-600">Total Pools</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mx-auto mb-2" />
              <div className="text-lg sm:text-2xl font-bold text-green-600">{dashboardStats.activePools}</div>
              <div className="text-xs sm:text-sm text-gray-600">Active Pools</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 mx-auto mb-2" />
              <div className="text-lg sm:text-2xl font-bold text-purple-600">{dashboardStats.totalParticipants}</div>
              <div className="text-xs sm:text-sm text-gray-600">Participants</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 mx-auto mb-2" />
              <div className="text-lg sm:text-2xl font-bold text-orange-600">{dashboardStats.totalGames}</div>
              <div className="text-xs sm:text-sm text-gray-600">
                Week {currentWeek} Games
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {currentSeasonType === 1 ? 'Preseason' : currentSeasonType === 2 ? 'Regular Season' : 'Postseason'}
              </div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600 mx-auto mb-2" />
              <div className="text-lg sm:text-2xl font-bold text-yellow-600">{dashboardStats.pendingSubmissions}</div>
              <div className="text-xs sm:text-sm text-gray-600">Pending</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mx-auto mb-2" />
              <div className="text-lg sm:text-2xl font-bold text-green-600">{dashboardStats.completedSubmissions}</div>
              <div className="text-xs sm:text-sm text-gray-600">Submitted</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6">
          <CardHeader className="pb-4 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <Button
                onClick={() => handleQuickAction('create-pool')}
                variant="outline"
                className="flex flex-col items-center gap-2 h-16 sm:h-20"
              >
                <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Create Pool</span>
              </Button>
              <Button
                onClick={() => handleQuickAction('view-leaderboard')}
                variant="outline"
                className="flex flex-col items-center gap-2 h-16 sm:h-20"
              >
                <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">View Leaderboard</span>
              </Button>
              <Button
                onClick={() => handleQuickAction('send-reminders')}
                variant="outline"
                className="flex flex-col items-center gap-2 h-16 sm:h-20"
              >
                <Mail className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Send Reminders</span>
              </Button>
                  </div>
                </CardContent>
              </Card>

        {/* Super Admin Management */}
        {user?.is_super_admin && (
          <Card className="mb-6">
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
                Admin Management
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Manage other admin accounts and reset passwords
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-4">
                {/* Admin List */}
                <div>
                  <h4 className="font-medium mb-3 text-sm sm:text-base">All Admins ({admins.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {admins.map((admin) => (
                      <div key={admin.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 rounded-lg gap-2 sm:gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm sm:text-base truncate">{admin.full_name || 'No name'}</div>
                          <div className="text-xs sm:text-sm text-gray-600 truncate">{admin.email}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          {admin.is_super_admin && (
                            <Badge variant="outline" className="text-xs">Super Admin</Badge>
                          )}
                          <Badge variant={admin.is_active ? "default" : "secondary"} className="text-xs">
                            {admin.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            onClick={() => {
                              setResetEmail(admin.email);
                              setAdminManagementOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1 h-7 sm:h-8 text-xs"
                          >
                            <Key className="h-3 w-3" />
                            <span className="hidden sm:inline">Reset</span>
                            <span className="sm:hidden">Reset</span>
                          </Button>
                        </div>
                      </div>
            ))}
          </div>
        </div>

                {/* Quick Reset */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    placeholder="Enter admin email to reset password"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="flex-1 h-9 sm:h-10 text-sm sm:text-base"
                  />
                  <Button
                    onClick={() => setAdminManagementOpen(true)}
                    disabled={!resetEmail.trim()}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 h-9 sm:h-10 text-xs sm:text-sm"
                  >
                    <Key className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Reset Password</span>
                    <span className="sm:hidden">Reset</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Week Info */}
        <div className="mt-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">Current Week: {currentWeek}</h3>
              <p className="text-blue-700 text-xs sm:text-sm">
            {user?.is_super_admin 
                  ? 'Manage all pools, participants, and view current standings.'
                  : `Manage your ${dashboardStats.totalPools} pool${dashboardStats.totalPools !== 1 ? 's' : ''}, ${dashboardStats.totalParticipants} participant${dashboardStats.totalParticipants !== 1 ? 's' : ''}, and view current standings.`
            }
          </p>
              {!user?.is_super_admin && dashboardStats.totalPools > 0 && (
                <p className="text-blue-600 text-xs mt-1">
                  {dashboardStats.completedSubmissions} of {dashboardStats.totalParticipants} participants have submitted picks
                </p>
              )}
            </div>
            <div className="text-right text-xs sm:text-sm text-blue-600 flex-shrink-0">
              <div>Last updated:</div>
              <div>{lastRefresh.toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      </div>

      <PoolDashboard hideCreateButton={true} />

      {/* Password Reset Dialog */}
      <Dialog open={adminManagementOpen} onOpenChange={setAdminManagementOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Reset Admin Password</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              This will send a password reset email to the specified admin account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reset-email" className="text-sm font-medium">Admin Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="admin@example.com"
                className="h-10 sm:h-11 text-sm sm:text-base"
              />
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs sm:text-sm text-yellow-800">
                <strong>Note:</strong> This will send a password reset email to {resetEmail}. 
                The admin will need to click the link in the email to set a new password.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setAdminManagementOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={resetAdminPassword}
              disabled={isResetting || !resetEmail.trim()}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <Key className="h-4 w-4" />
              {isResetting ? 'Sending...' : 'Send Reset Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AuthProvider>
      <AdminDashboardContent />
    </AuthProvider>
  );
} 