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
  AlertTriangle
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

function CommissionersManagementContent() {
  const { user, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [commissioners, setCommissioners] = useState<Admin[]>([]);
  const [filteredCommissioners, setFilteredCommissioners] = useState<Admin[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalCommissioners: 0,
    activeCommissioners: 0,
    inactiveCommissioners: 0
  });
  const [selectedCommissioner, setSelectedCommissioner] = useState<Admin | null>(null);
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
            router.push('/dashboard');
            return;
          }
          
          // Load commissioners data
          await loadCommissioners();
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

  const loadCommissioners = async () => {
    try {
      if (!user?.email) return;
      
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      // Get all admins (both super admins and commissioners)
      const { data: adminsData, error: adminsError } = await supabase
        .from('admins')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (adminsError) throw adminsError;
      
      // Filter to only show commissioners (non-super admins)
      const commissionersData = adminsData?.filter(admin => !admin.is_super_admin) || [];
      setCommissioners(commissionersData);
      setFilteredCommissioners(commissionersData);
      
      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log('Commissioners loaded:', {
          userRole: 'admin',
          userEmail: user.email,
          totalCommissioners: commissionersData.length,
          commissionersData: commissionersData.map(c => ({
            id: c.id,
            email: c.email,
            full_name: c.full_name,
            is_active: c.is_active,
            created_at: c.created_at
          }))
        });
      }
      
    } catch (error) {
      console.error('Error loading commissioners:', error);
      toast({
        title: 'Error',
        description: 'Failed to load commissioners data',
        variant: 'destructive',
      });
    }
  };

  const loadStats = async () => {
    try {
      if (!user?.email) return;
      
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      // Get commissioners stats
      const { data: commissionersData } = await supabase
        .from('admins')
        .select('is_active')
        .eq('is_super_admin', false);
      
      const totalCommissioners = commissionersData?.length || 0;
      const activeCommissioners = commissionersData?.filter(c => c.is_active).length || 0;
      const inactiveCommissioners = totalCommissioners - activeCommissioners;
      
      setStats({
        totalCommissioners,
        activeCommissioners,
        inactiveCommissioners
      });
      
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredCommissioners(commissioners);
    } else {
      const filtered = commissioners.filter(commissioner => 
        commissioner.full_name?.toLowerCase().includes(term.toLowerCase()) ||
        commissioner.email.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredCommissioners(filtered);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedCommissioner || !newPassword.trim()) {
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

      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          adminId: selectedCommissioner.id,
          newPassword: newPassword.trim()
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Password Reset Successfully',
          description: `Password has been reset for ${selectedCommissioner.email}`,
        });
        setResetPasswordModalOpen(false);
        setNewPassword('');
        setSelectedCommissioner(null);
      } else {
        throw new Error(result.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleStatus = async (commissioner: Admin) => {
    setIsProcessing(true);
    try {
      // Get the current session token
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/admin/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          adminId: commissioner.id,
          isActive: !commissioner.is_active
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Status Updated',
          description: `${commissioner.email} has been ${commissioner.is_active ? 'deactivated' : 'activated'}`,
        });
        // Reload commissioners to get updated data
        await loadCommissioners();
        await loadStats();
      } else {
        throw new Error(result.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Status update error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCommissioner = async () => {
    if (!selectedCommissioner) return;

    setIsProcessing(true);
    try {
      // Get the current session token
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/admin/delete-commissioner', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          adminId: selectedCommissioner.id
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Commissioner Deleted',
          description: `${selectedCommissioner.email} has been permanently deleted`,
        });
        setDeleteModalOpen(false);
        setSelectedCommissioner(null);
        // Reload commissioners to get updated data
        await loadCommissioners();
        await loadStats();
      } else {
        throw new Error(result.error || 'Failed to delete commissioner');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete commissioner. Please try again.',
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
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <h1 className="text-2xl sm:text-3xl font-bold">Commissioners Management</h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Manage all commissioner accounts in the system
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
                  <Trash2 className="h-3 w-3 sm:h-4 sm:h-4" />
                  <span className="hidden sm:inline">Logout</span>
                  <span className="sm:hidden">Logout</span>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => router.push('/admin/register')}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Add Commissioner
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Commissioners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCommissioners}</div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeCommissioners}</div>
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
              <div className="text-2xl font-bold text-red-600">{stats.inactiveCommissioners}</div>
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
              Search Commissioners
            </CardTitle>
            <CardDescription>
              Find commissioners by name or email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search commissioners..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="max-w-md"
            />
          </CardContent>
        </Card>

        {/* Commissioners List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Commissioners ({filteredCommissioners.length})
            </CardTitle>
            <CardDescription>
              Manage commissioner accounts, reset passwords, and control access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredCommissioners.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No commissioners found matching your search.' : 'No commissioners created yet.'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCommissioners.map((commissioner) => (
                  <div key={commissioner.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <Shield className="h-8 w-8 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {commissioner.full_name || 'Unnamed Commissioner'}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {commissioner.email}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Badge variant={commissioner.is_active ? "default" : "secondary"}>
                                {commissioner.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge variant="outline">
                                Commissioner
                              </Badge>
                              <Badge variant="outline">
                                Created: {new Date(commissioner.created_at).toLocaleDateString()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => {
                            setSelectedCommissioner(commissioner);
                            setResetPasswordModalOpen(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Key className="h-4 w-4" />
                          Reset Password
                        </Button>
                        
                        <Button
                          onClick={() => handleToggleStatus(commissioner)}
                          variant={commissioner.is_active ? "destructive" : "default"}
                          size="sm"
                          className="flex items-center gap-2"
                          disabled={isProcessing}
                        >
                          {commissioner.is_active ? (
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
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex items-center gap-2"
                              disabled={isProcessing}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                                Delete Commissioner
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to permanently delete {selectedCommissioner?.full_name || selectedCommissioner?.email}? 
                                This action cannot be undone and will remove all their access to the system.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  setSelectedCommissioner(commissioner);
                                  setDeleteModalOpen(true);
                                }}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete Permanently
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
              <Key className="h-5 w-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for {selectedCommissioner?.full_name || selectedCommissioner?.email}
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
                  className="pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              <p>• Password should be at least 8 characters long</p>
              <p>• The commissioner will need to use this password to log in</p>
              <p>• Consider using a secure password generator</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setResetPasswordModalOpen(false);
                  setNewPassword('');
                  setSelectedCommissioner(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={!newPassword.trim() || isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" />
                    Reset Password
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you absolutely sure you want to delete this commissioner?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedCommissioner && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <h4 className="font-medium text-sm text-red-800 mb-2">Commissioner Details</h4>
                <div className="space-y-1 text-sm text-red-700">
                  <p><span className="font-medium">Name:</span> {selectedCommissioner.full_name || 'Unnamed'}</p>
                  <p><span className="font-medium">Email:</span> {selectedCommissioner.email}</p>
                  <p><span className="font-medium">Status:</span> {selectedCommissioner.is_active ? 'Active' : 'Inactive'}</p>
                  <p><span className="font-medium">Created:</span> {new Date(selectedCommissioner.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            )}

            <div className="text-xs text-red-600">
              <p>⚠️ This will permanently remove the commissioner from the system</p>
              <p>⚠️ All their pool access will be revoked</p>
              <p>⚠️ This action cannot be undone</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSelectedCommissioner(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteCommissioner}
                variant="destructive"
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Permanently
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CommissionersManagementPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <CommissionersManagementContent />
      </AdminGuard>
    </AuthProvider>
  );
}
