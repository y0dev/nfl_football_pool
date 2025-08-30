'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PoolDashboard } from '@/components/pools/pool-dashboard';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { adminService, DashboardStats, Pool, Admin } from '@/lib/admin-service';
import { ImportedPick } from '@/types/import';
import { LogOut, Users, Trophy, Calendar, Clock, TrendingUp, Activity, Settings, Plus, BarChart3, Mail, Share2, RefreshCw, Bell, Zap, Shield, Key, Trash2, Upload, FileSpreadsheet } from 'lucide-react';
import { createMailtoUrl, openEmailClient, copyMailtoToClipboard, createPoolInviteEmail } from '@/lib/mailto-utils';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { debugLog } from '@/lib/utils';

function AdminDashboardContent() {
  const { user, signOut, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2); // Default to regular season
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
  const [adminManagementOpen, setAdminManagementOpen] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(false);
  const [selectedAdminForDelete, setSelectedAdminForDelete] = useState<Admin | null>(null);
  const [poolSelectionOpen, setPoolSelectionOpen] = useState(false);
  const [availablePools, setAvailablePools] = useState<Array<{id: string, name: string}>>([]);
  const [importPicksOpen, setImportPicksOpen] = useState(false);
  const [selectedPoolForImport, setSelectedPoolForImport] = useState<{id: string, name: string} | null>(null);
  const [importedData, setImportedData] = useState<ImportedPick[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [poolSelectionMode, setPoolSelectionMode] = useState<'invite' | 'import'>('invite');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

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
            router.push('/dashboard');
            return;
          }
          
          if (superAdminStatus) {
            debugLog('Loading admins...');
            await loadAdmins();
            debugLog('Admins loaded');
          }
        }
        
        // Don't call loadDashboardStats here - wait for isSuperAdmin to be set
        // generateNotifications will be called after loadDashboardStats
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
      generateNotifications();
    }
  }, [currentWeek, currentSeasonType, isSuperAdmin]);

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
      
      // Also load available pools for the pool selection
      const pools = await adminService.getActivePools(
        user.email,
        true // isSuperAdmin = true for admin dashboard
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

  const loadAdmins = async () => {
    debugLog('Function: loadAdmins - Loading admins...');
    // if (!isSuperAdmin) return;
    
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
    
    // Only show notifications if admin has pools to manage
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
    
    // Add admin-specific notifications
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
          router.push('/admin/reminders');
        } else {
          toast({
            title: 'No Reminders Needed',
            description: 'All participants have submitted their picks!',
          });
        }
        break;
      case 'override-picks':
        router.push('/admin/override-picks');
        break;
      case 'send-invite':
        handleSendInvite();
        break;
      case 'import-picks':
        toast({
          title: 'Feature Disabled',
          description: 'Import CSV functionality is temporarily disabled',
          variant: 'destructive',
        });
        break;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    processFile(file);
    
    // Reset file input
    event.target.value = '';
  };

  const handleSubmitImport = async () => {
    if (!selectedPoolForImport || importedData.length === 0) return;

    try {
      setIsImporting(true);
      const response = await fetch('/api/admin/import-picks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poolId: selectedPoolForImport.id,
          participants: importedData,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Import Successful',
          description: `Successfully imported ${result.importedCount} participants with picks`,
        });
        setImportPicksOpen(false);
        setImportedData([]);
        setSelectedPoolForImport(null);
        // Refresh dashboard stats
        await loadDashboardStats();
      } else {
        toast({
          title: 'Import Failed',
          description: result.error || 'Failed to import picks',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error importing picks:', error);
      toast({
        title: 'Import Error',
        description: 'Failed to import picks',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportPicks = async () => {
    try {
      // Get active pools for this admin using the service
      if (!user?.email) return;
      
      const pools = await adminService.getActivePools(
        user.email,
        true // isSuperAdmin = true for admin dashboard
      );

      if (!pools || pools.length === 0) {
        toast({
          title: 'No Pools Available',
          description: 'You need to create a pool first before importing picks. Click "Create Pool" to get started.',
          variant: 'destructive',
        });
        // Trigger the create pool dialog
        const event = new CustomEvent('openCreatePoolDialog');
        document.dispatchEvent(event);
        return;
      }
      
      // If only one pool, use it directly
      if (pools.length === 1) {
        setSelectedPoolForImport(pools[0]);
        setImportPicksOpen(true);
        return;
      }
      
      // If multiple pools, show selection dialog for import
      setAvailablePools(pools);
      setPoolSelectionMode('import');
      setPoolSelectionOpen(true);
      
    } catch (error) {
      console.error('Error preparing import picks:', error);
      toast({
        title: 'Error',
        description: 'Failed to prepare import picks',
        variant: 'destructive',
      });
    }
  };

  const handleSendInvite = async () => {
    try {
      // Get active pools for this admin using the service
      if (!user?.email) return;
      
      const pools = await adminService.getActivePools(
        user.email,
        true // isSuperAdmin = true for admin dashboard
      );
      debugLog('pools', pools);

      if (!pools || pools.length === 0) {
        toast({
          title: 'No Pools Available',
          description: 'You need to create a pool first before sending invitations. Click "Create Pool" to get started.',
          variant: 'destructive',
        });
        // Trigger the create pool dialog
        const event = new CustomEvent('openCreatePoolDialog');
        document.dispatchEvent(event);
        return;
      }
      
      // If only one pool, use it directly
      if (pools.length === 1) {
        await sendInviteForPool(pools[0]);
        return;
      }
      
      // If multiple pools, show selection dialog for invite
      setAvailablePools(pools);
      setPoolSelectionMode('invite');
      setPoolSelectionOpen(true);
      
    } catch (error) {
      console.error('Error preparing invite email:', error);
      toast({
        title: 'Error',
        description: 'Failed to prepare invite email',
        variant: 'destructive',
      });
    }
  };

  const sendInviteForPool = async (selectedPool: {id: string, name: string}) => {
    try {
      // Create a pool invite email
      const emailOptions = createPoolInviteEmail(
        selectedPool.name, 
        selectedPool.id, 
        currentWeek,
        user?.email
      );
      
      const mailtoUrl = createMailtoUrl(emailOptions);
      
      // Try to open email client
      const opened = await openEmailClient(mailtoUrl);
      
      if (opened) {
        toast({
          title: 'Email Client Opened',
          description: `Pool invite email prepared for ${selectedPool.name}. Your email client should open automatically.`,
        });
      } else {
        // Fallback: copy mailto URL to clipboard
        const copied = await copyMailtoToClipboard(mailtoUrl);
        
        if (copied) {
          toast({
            title: 'Email URL Copied',
            description: 'Email URL copied to clipboard. Paste it in your browser address bar to open your email client.',
          });
        } else {
          toast({
            title: 'Manual Action Required',
            description: `Please copy this URL and paste it in your browser: ${mailtoUrl}`,
            variant: 'destructive',
          });
        }
      }
      
      // Close the dialog if it was open
      setPoolSelectionOpen(false);
    } catch (error) {
      console.error('Error sending invite for pool:', error);
      toast({
        title: 'Error',
        description: 'Failed to prepare invite email',
        variant: 'destructive',
      });
    }
  };

  const handlePoolSelectionForImport = async (selectedPool: {id: string, name: string}) => {
    try {
      setSelectedPoolForImport(selectedPool);
      setPoolSelectionOpen(false);
      setImportPicksOpen(true);
    } catch (error) {
      console.error('Error selecting pool for import:', error);
      toast({
        title: 'Error',
        description: 'Failed to select pool for import',
        variant: 'destructive',
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      // Process the dropped file directly
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv' // alternative CSV MIME type
    ];
    
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select an Excel (.xlsx, .xls) or CSV file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: 'File Too Large',
        description: 'Please select a file smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    // Process the file
    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    try {
      // Show loading state
      toast({
        title: 'Processing File',
        description: `Processing ${file.name}...`,
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('poolId', selectedPoolForImport?.id || '');

      const response = await fetch('/api/admin/import-picks', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setImportedData(result.data);
        toast({
          title: 'File Processed Successfully',
          description: `Successfully parsed ${result.data.length} participants from ${file.name}`,
        });
      } else {
        toast({
          title: 'File Processing Failed',
          description: result.error || 'Failed to parse file. Please check the file format.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload Error',
        description: 'Failed to upload file. Please try again.',
        variant: 'destructive',
      });
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

  const toggleAdminStatus = async (admin: Admin) => {
    try {
      const response = await fetch('/api/super-admin/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId: admin.id,
          isActive: !admin.is_active,
        }),
      });

      const result = await response.json();
      debugLog('Super Admin: Toggle admin status result', result);
      if (result.success) {
        toast({
          title: 'Success',
          description: `Admin ${admin.is_active ? 'deactivated' : 'activated'} successfully`,
        });
        loadAdmins();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update admin status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error toggling admin status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update admin status',
        variant: 'destructive',
      });
    }
  };

  const deleteAdmin = async (admin: Admin) => {
    if (!admin || !user) return;

    setIsDeletingAdmin(true);
    try {
      const response = await fetch('/api/super-admin/delete-admin', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId: admin.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Admin ${admin.full_name} deleted successfully`,
        });
        loadAdmins();
        setSelectedAdminForDelete(null);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete admin',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting admin:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete admin',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingAdmin(false);
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
              Admin Dashboard
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              Manage all NFL Confidence Pools
            </p>
            {user?.full_name && (
              <p className="text-sm sm:text-base text-blue-600 font-medium mt-1">
                Welcome, {user.full_name}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                Admin
              </Badge>
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
              variant="destructive"
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

        
        {/* Current Week Info */}
        <div className="mb-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">Current Week: {currentWeek}</h3>
              <p className="text-blue-700 text-xs sm:text-sm">
                Manage all pools, participants, and view current standings.
              </p>
            </div>
            <div className="text-right text-xs sm:text-sm text-blue-600 flex-shrink-0">
              <div>Last updated:</div>
              <div>{lastRefresh.toLocaleTimeString()}</div>
            </div>
          </div>
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
              <Button
                onClick={() => handleQuickAction('override-picks')}
                variant="outline"
                className="flex flex-col items-center gap-2 h-16 sm:h-20"
              >
                <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Override Picks</span>
              </Button>
              <Button
                onClick={() => handleQuickAction('send-invite')}
                variant="outline"
                className="flex flex-col items-center gap-2 h-16 sm:h-20"
              >
                <Mail className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Send Invite</span>
              </Button>
              <Button
                onClick={() => handleQuickAction('import-picks')}
                variant="outline"
                className="flex flex-col items-center gap-2 h-16 sm:h-20"
                disabled={true}
                title="Import CSV functionality is temporarily disabled"
              >
                <Upload className="h-5 w-5 sm:h-6 sm:w-6 opacity-50" />
                <span className="text-xs sm:text-sm opacity-50">Import Picks</span>
                <span className="text-xs text-gray-500">(Disabled)</span>
              </Button>
                  </div>
                </CardContent>
        </Card>

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

        {/* Admin Management */}
        {isSuperAdmin && (
          <>
            {/* Admin Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <Card className="text-center">
                <CardContent className="p-3 sm:p-4">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-lg sm:text-2xl font-bold text-blue-600">{admins.length}</div>
                  <div className="text-xs sm:text-sm text-gray-600">Total Commissioners</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-3 sm:p-4">
                  <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-lg sm:text-2xl font-bold text-purple-600">
                    {admins.filter(admin => admin.is_super_admin).length}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Admins</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-3 sm:p-4">
                  <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-lg sm:text-2xl font-bold text-green-600">
                    {admins.filter(admin => admin.is_active).length}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Active Commissioners</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-3 sm:p-4">
                  <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 mx-auto mb-2" />
                  <div className="text-lg sm:text-2xl font-bold text-orange-600">
                    {admins.filter(admin => !admin.is_active).length}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Inactive Commissioners</div>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6">
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
                  Commissioner Management
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Manage other commissioner accounts and reset passwords
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-4">
                  {/* Admin List */}
                  <div>
                    <h4 className="font-medium mb-3 text-sm sm:text-base">All Commissioners ({admins.length})</h4>
                    <div className="space-y-3 sm:space-y-4 max-h-60 overflow-y-auto">
                      {admins.map((admin) => (
                        <div key={admin.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg gap-2 sm:gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-sm sm:text-base truncate">{admin.full_name || 'No name'}</h3>
                                <p className="text-xs sm:text-sm text-gray-600 truncate">{admin.email}</p>
                              </div>
                              <div className="flex flex-wrap gap-1 sm:gap-2">
                                {admin.is_super_admin && (
                                  <Badge variant="default" className="text-xs">Admin</Badge>
                                )}
                                <Badge variant={admin.is_active ? "default" : "secondary"} className="text-xs">
                                  {admin.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Created: {new Date(admin.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-2">
                            {user && (
                              <>
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
                                <Button
                                  onClick={() => toggleAdminStatus(admin)}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1 h-7 sm:h-8 text-xs"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  <span className="hidden sm:inline">{admin.is_active ? 'Deactivate' : 'Activate'}</span>
                                  <span className="sm:hidden">{admin.is_active ? 'Deactivate' : 'Activate'}</span>
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      onClick={() => setSelectedAdminForDelete(admin)}
                                      variant="outline"
                                      size="sm"
                                      className="flex items-center gap-1 h-7 sm:h-8 text-xs text-red-600 hover:text-red-700"
                                      disabled={isDeletingAdmin}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      <span className="hidden sm:inline">Delete</span>
                                      <span className="sm:hidden">Del</span>
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="sm:max-w-md">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-lg sm:text-xl text-red-600">
                                        Delete Commissioner Account
                                      </AlertDialogTitle>
                                      <AlertDialogDescription className="text-sm sm:text-base">
                                        Are you sure you want to permanently delete {admin.full_name} ({admin.email})? 
                                        This action cannot be undone and will remove all their access to the system.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                      <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteAdmin(admin)}
                                        className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
                                        disabled={isDeletingAdmin}
                                      >
                                        {isDeletingAdmin ? 'Deleting...' : 'Delete Admin'}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Reset */}
                  {user && (
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
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

      </div>

      <PoolDashboard hideCreateButton={true} />

      {/* Password Reset Dialog */}
      <Dialog open={adminManagementOpen} onOpenChange={setAdminManagementOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Reset Admin Password</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              This will send a password reset email to the specified commissioner account.
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
                The commissioner will need to click the link in the email to set a new password.
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

      {/* Pool Selection Dialog */}
      <Dialog open={poolSelectionOpen} onOpenChange={setPoolSelectionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {poolSelectionMode === 'import' ? 'Select Pool for Import' : 'Select Pool for Invitation'}
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              {poolSelectionMode === 'import' 
                ? 'Choose which pool you\'d like to import picks for.'
                : 'Choose which pool you\'d like to send an invitation for.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-60 overflow-y-auto space-y-2">
              {availablePools.map((pool) => (
                <div
                  key={pool.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => poolSelectionMode === 'import' ? handlePoolSelectionForImport(pool) : sendInviteForPool(pool)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm sm:text-base">{pool.name}</h4>
                      {isSuperAdmin && (
                        <p className="text-xs text-gray-500">Pool ID: {pool.id}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 h-7 sm:h-8 text-xs"
                    >
                      {poolSelectionMode === 'import' ? (
                        <>
                          <Upload className="h-3 w-3" />
                          <span className="hidden sm:inline">Import Picks</span>
                          <span className="sm:hidden">Import</span>
                        </>
                      ) : (
                        <>
                          <Mail className="h-3 w-3" />
                          <span className="hidden sm:inline">Send Invite</span>
                          <span className="sm:hidden">Invite</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-800">
                <strong>Note:</strong> Click on any pool above to {poolSelectionMode === 'import' ? 'import picks for' : 'send an invitation email for'} that specific pool.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPoolSelectionOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Picks Dialog */}
      <Dialog open={importPicksOpen} onOpenChange={setImportPicksOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Picks for {selectedPoolForImport?.name}
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Upload an Excel or CSV file with participant picks. The file should have columns for participant name, game picks, and confidence points.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* File Upload Section */}
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className={`h-12 w-12 mx-auto mb-4 ${
                isDragOver ? 'text-blue-400' : 'text-gray-400'
              }`} />
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Expected File Format
                  </p>
                  <p className="text-xs text-gray-500">
                    Excel (.xlsx, .xls) or CSV file (max 5MB)
                  </p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-3 text-left">
                  <p className="text-xs font-medium text-gray-700 mb-2">Required Columns:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• <strong>Name:</strong> Participant&apos;s full name</li>
                    <li>• <strong>Game Picks:</strong> Team names for each game</li>
                    <li>• <strong>Confidence Points:</strong> 1-16 for each pick</li>
                    <li>• <strong>Tie Breaker:</strong> Total points prediction (optional)</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    variant="outline"
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Upload className="h-4 w-4" />
                    Choose Excel/CSV File
                  </Button>
                  <p className="text-xs text-gray-500">
                    Click to browse and select your file, or drag and drop here
                  </p>
                </div>
              </div>
            </div>

            {/* Preview Section */}
            {importedData.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Preview ({importedData.length} participants)</h3>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 border-b">Name</th>
                        <th className="text-left p-2 border-b">Games</th>
                        <th className="text-left p-2 border-b">Confidence</th>
                        <th className="text-left p-2 border-b">Tie Breaker</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedData.map((participant, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2">{participant.participantName}</td>
                          <td className="p-2">
                            <div className="text-xs space-y-1">
                              {participant.gamePicks.map((pick, pickIndex) => (
                                <div key={pickIndex} className="flex items-center gap-2">
                                  <span className="text-gray-600">{pick.awayTeam} @ {pick.homeTeam}</span>
                                  <span className="font-medium">{pick.predictedWinner}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="text-xs space-y-1">
                              {participant.gamePicks.map((pick, pickIndex) => (
                                <div key={pickIndex} className="text-center">
                                  {pick.confidencePoints}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            {participant.tieBreaker || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setImportPicksOpen(false);
                setImportedData([]);
                setSelectedPoolForImport(null);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitImport}
              disabled={isImporting || importedData.length === 0}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <Upload className="h-4 w-4" />
              {isImporting ? 'Importing...' : `Import ${importedData.length} Participants`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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