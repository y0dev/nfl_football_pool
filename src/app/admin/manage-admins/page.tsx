'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  Search,
  Users,
  Shield,
  Eye,
  EyeOff,
  Trash2,
  Mail,
  RefreshCw,
  Key,
  UserX,
  UserCheck,
  AlertTriangle,
  Crown,
  Settings,
  Lock
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminService, Admin } from '@/lib/admin-service';
import { debugLog } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

function ManageAdminsContent() {
  const { user, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [filteredAdmins, setFilteredAdmins] = useState<Admin[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalAdmins: 0,
    superAdmins: 0,
    commissioners: 0,
    activeAdmins: 0,
    inactiveAdmins: 0
  });
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check admin status
        if (user) {
          debugLog('Checking admin status for user:', user.email);
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);
          debugLog('Super admin status:', superAdminStatus);
          
          // Only super admins can access this page
          if (!superAdminStatus) {
            router.push('/admin/dashboard');
            return;
          }
          
          // Load admins data
          await loadAdmins();
          await loadStats();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, verifyAdminStatus, router]);

  const loadAdmins = async () => {
    try {
      if (!user?.email) return;
      
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      // Get all admins
      const { data: adminsData, error: adminsError } = await supabase
        .from('admins')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (adminsError) throw adminsError;
      
      setAdmins(adminsData || []);
      setFilteredAdmins(adminsData || []);
      
      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log('Admins loaded:', {
          userRole: 'super_admin',
          userEmail: user.email,
          totalAdmins: adminsData?.length,
          adminsData: adminsData?.map(a => ({
            id: a.id,
            email: a.email,
            full_name: a.full_name,
            is_super_admin: a.is_super_admin,
            is_active: a.is_active,
            created_at: a.created_at
          }))
        });
      }
      
    } catch (error) {
      console.error('Error loading admins:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admins data',
        variant: 'destructive',
      });
    }
  };

  const loadStats = async () => {
    try {
      if (!user?.email) return;
      
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      // Get admins stats
      const { data: adminsData } = await supabase
        .from('admins')
        .select('is_super_admin, is_active');
      
      const totalAdmins = adminsData?.length || 0;
      const superAdmins = adminsData?.filter(a => a.is_super_admin).length || 0;
      const commissioners = totalAdmins - superAdmins;
      const activeAdmins = adminsData?.filter(a => a.is_active).length || 0;
      const inactiveAdmins = totalAdmins - activeAdmins;
      
      setStats({
        totalAdmins,
        superAdmins,
        commissioners,
        activeAdmins,
        inactiveAdmins
      });
      
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredAdmins(admins);
    } else {
      const filtered = admins.filter(admin => 
        admin.full_name?.toLowerCase().includes(term.toLowerCase()) ||
        admin.email.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredAdmins(filtered);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedAdmin || !newPassword.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a new password',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Get the current session token
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/admin/reset-admin-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          adminId: selectedAdmin.id,
          newPassword: newPassword
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Password Reset',
          description: `Password has been reset for ${selectedAdmin.email}`,
        });
        setResetPasswordModalOpen(false);
        setSelectedAdmin(null);
        setNewPassword('');
      } else {
        throw new Error(result.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleStatus = async (admin: Admin) => {
    setIsProcessing(true);
    try {
      // Get the current session token
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/admin/toggle-admin-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          adminId: admin.id
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Status Updated',
          description: `${admin.email} has been ${admin.is_active ? 'deactivated' : 'activated'}`,
        });
        // Reload admins to get updated data
        await loadAdmins();
        await loadStats();
      } else {
        throw new Error(result.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Toggle status error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;

    setIsProcessing(true);
    try {
      // Get the current session token
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/admin/delete-admin', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          adminId: selectedAdmin.id
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Admin Deleted',
          description: `${selectedAdmin.email} has been permanently deleted`,
        });
        setDeleteModalOpen(false);
        setSelectedAdmin(null);
        // Reload admins to get updated data
        await loadAdmins();
        await loadStats();
      } else {
        throw new Error(result.error || 'Failed to delete admin');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete admin. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
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
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <h1 className="text-2xl sm:text-3xl font-bold">Admin Management</h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Manage all admin accounts in the system
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  Super Admin
                </Badge>
                <Button
                  onClick={handleLogout}
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-2 h-7 sm:h-8 text-xs"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:h-4" />
                  <span className="hidden sm:inline">Logout</span>
                  <span className="sm:hidden">Logout</span>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => router.push('/admin/create-commissioner')}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Add Commissioner
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Admins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAdmins}</div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.superAdmins}</div>
              <p className="text-xs text-muted-foreground">
                Full access
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Commissioners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.commissioners}</div>
              <p className="text-xs text-muted-foreground">
                Limited access
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeAdmins}</div>
              <p className="text-xs text-muted-foreground">
                Currently active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.inactiveAdmins}</div>
              <p className="text-xs text-muted-foreground">
                Deactivated
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Admins
            </CardTitle>
            <CardDescription>
              Find admins by name or email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search admins..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="max-w-md"
            />
          </CardContent>
        </Card>

        {/* Admins List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              All Admins ({filteredAdmins.length})
            </CardTitle>
            <CardDescription>
              Manage admin accounts, reset passwords, and control access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAdmins.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No admins found matching your search.' : 'No admins created yet.'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAdmins.map((admin) => (
                  <div key={admin.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                              {admin.full_name?.charAt(0).toUpperCase() || admin.email.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-semibold text-gray-900 truncate">
                                {admin.full_name || 'No Name'}
                              </h3>
                              <div className="flex items-center gap-1">
                                {admin.is_super_admin ? (
                                  <Badge variant="default" className="bg-purple-100 text-purple-800 border-purple-200">
                                    <Crown className="h-3 w-3 mr-1" />
                                    Super Admin
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Commissioner
                                  </Badge>
                                )}
                                {admin.is_active ? (
                                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <UserX className="h-3 w-3 mr-1" />
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-600 mb-2">{admin.email}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>Created: {new Date(admin.created_at).toLocaleDateString()}</span>
                              <span>ID: {admin.id}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAdmin(admin);
                            setResetPasswordModalOpen(true);
                          }}
                          className="flex items-center gap-2"
                        >
                          <Key className="h-4 w-4" />
                          Reset Password
                        </Button>
                        
                        <Button
                          variant={admin.is_active ? "destructive" : "default"}
                          size="sm"
                          onClick={() => handleToggleStatus(admin)}
                          disabled={isProcessing}
                          className="flex items-center gap-2"
                        >
                          {admin.is_active ? (
                            <>
                              <UserX className="h-4 w-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4" />
                              Activate
                            </>
                          )}
                        </Button>
                        
                        {!admin.is_super_admin && (
                          <AlertDialog open={deleteModalOpen && selectedAdmin?.id === admin.id} onOpenChange={(open) => {
                            if (open) {
                              setSelectedAdmin(admin);
                              setDeleteModalOpen(true);
                            } else {
                              setDeleteModalOpen(false);
                              setSelectedAdmin(null);
                            }
                          }}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="flex items-center gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Admin</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to permanently delete {admin.email}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDeleteAdmin}
                                  className="bg-red-600 hover:bg-red-700"
                                  disabled={isProcessing}
                                >
                                  {isProcessing ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reset Password Modal */}
      <Dialog open={resetPasswordModalOpen} onOpenChange={setResetPasswordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for {selectedAdmin?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password" className="text-sm font-medium">
                New Password
              </Label>
              <div className="relative mt-2">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Password must be at least 6 characters long
              </p>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleResetPassword}
                disabled={isProcessing || newPassword.length < 6}
                className="flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Resetting...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" />
                    Reset Password
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setResetPasswordModalOpen(false);
                  setSelectedAdmin(null);
                  setNewPassword('');
                }}
                disabled={isProcessing}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ManageAdminsPage() {
  return (
    <AuthProvider>
      <AdminGuard requireSuperAdmin={true}>
        <ManageAdminsContent />
      </AdminGuard>
    </AuthProvider>
  );
}
