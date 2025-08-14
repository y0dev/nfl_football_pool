'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Key, Plus, RefreshCw, Trash2, Eye, EyeOff, Activity } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Admin {
  id: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export default function SuperAdminPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSuperAdmin, setIsCreatingSuperAdmin] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const { toast } = useToast();

  // Form states for creating super admin
  const [superAdminForm, setSuperAdminForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });

  // Load admins on mount
  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      const response = await fetch('/api/super-admin/admins');
      const result = await response.json();
      
      if (result.success) {
        setAdmins(result.admins);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to load admins',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading admins:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admins',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createSuperAdmin = async () => {
    if (superAdminForm.password !== superAdminForm.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingSuperAdmin(true);
    try {
      const response = await fetch('/api/super-admin/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: superAdminForm.email,
          password: superAdminForm.password,
          fullName: superAdminForm.fullName,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Super admin account created successfully!',
        });
        setSuperAdminForm({ email: '', password: '', confirmPassword: '', fullName: '' });
        loadAdmins();
        
        // Redirect to admin dashboard after a short delay
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 2000);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create super admin',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating super admin:', error);
      toast({
        title: 'Error',
        description: 'Failed to create super admin',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingSuperAdmin(false);
    }
  };

  const resetAdminPassword = async () => {
    if (!selectedAdmin || !newPassword) {
      toast({
        title: 'Error',
        description: 'Please select an admin and enter a new password',
        variant: 'destructive',
      });
      return;
    }

    setIsResettingPassword(true);
    try {
      const response = await fetch('/api/super-admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId: selectedAdmin.id,
          newPassword,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Password reset successfully for ${selectedAdmin.email}`,
        });
        setSelectedAdmin(null);
        setNewPassword('');
        loadAdmins();
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
      setIsResettingPassword(false);
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
    if (!admin) return;

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
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            <h1 className="text-2xl sm:text-3xl font-bold">Super Admin Dashboard</h1>
          </div>
          <p className="text-sm sm:text-base text-gray-600">Manage admin accounts and system settings</p>
        </div>

        <Tabs defaultValue="admins" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="admins" className="text-xs sm:text-sm">Manage Admins</TabsTrigger>
            <TabsTrigger value="create" className="text-xs sm:text-sm">Create Super Admin</TabsTrigger>
          </TabsList>

          <TabsContent value="admins" className="space-y-4 sm:space-y-6">
            {/* Admin Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Card className="text-center">
                <CardContent className="p-3 sm:p-4">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-lg sm:text-2xl font-bold text-blue-600">{admins.length}</div>
                  <div className="text-xs sm:text-sm text-gray-600">Total Admins</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-3 sm:p-4">
                  <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-lg sm:text-2xl font-bold text-purple-600">
                    {admins.filter(admin => admin.is_super_admin).length}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Super Admins</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-3 sm:p-4">
                  <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-lg sm:text-2xl font-bold text-green-600">
                    {admins.filter(admin => admin.is_active).length}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Active Admins</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-3 sm:p-4">
                  <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 mx-auto mb-2" />
                  <div className="text-lg sm:text-2xl font-bold text-orange-600">
                    {admins.filter(admin => !admin.is_active).length}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Inactive Admins</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                  Admin Accounts
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  View and manage all admin accounts in the system
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-3 sm:space-y-4">
                  {admins.map((admin) => (
                    <div key={admin.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm sm:text-base truncate">{admin.full_name}</h3>
                            <p className="text-xs sm:text-sm text-gray-600 truncate">{admin.email}</p>
                          </div>
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            {admin.is_super_admin && (
                              <Badge variant="default" className="text-xs">Super Admin</Badge>
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
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedAdmin(admin)}
                              className="text-xs sm:text-sm h-8 sm:h-9"
                            >
                              <Key className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              <span className="hidden sm:inline">Reset Password</span>
                              <span className="sm:hidden">Reset</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle className="text-lg sm:text-xl">Reset Password for {admin.full_name}</DialogTitle>
                              <DialogDescription className="text-sm sm:text-base">
                                Enter a new password for {admin.email}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
                                <div className="relative">
                                  <Input
                                    id="newPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="pr-12 h-10 sm:h-11 text-sm sm:text-base"
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
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                onClick={resetAdminPassword}
                                disabled={isResettingPassword || !newPassword}
                                className="w-full sm:w-auto"
                              >
                                {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedAdmin(admin)}
                              className="text-xs sm:text-sm h-8 sm:h-9"
                            >
                              {admin.is_active ? (
                                <>
                                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                  <span className="hidden sm:inline">Deactivate</span>
                                  <span className="sm:hidden">Deactivate</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                  <span className="hidden sm:inline">Activate</span>
                                  <span className="sm:hidden">Activate</span>
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="sm:max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-lg sm:text-xl">
                                {admin.is_active ? 'Deactivate' : 'Activate'} Admin
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-sm sm:text-base">
                                Are you sure you want to {admin.is_active ? 'deactivate' : 'activate'} {admin.full_name}?
                                {admin.is_active ? ' They will no longer be able to access the admin dashboard.' : ' They will be able to access the admin dashboard again.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                              <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => toggleAdminStatus(admin)}
                                className={`w-full sm:w-auto ${admin.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                              >
                                {admin.is_active ? 'Deactivate' : 'Activate'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setSelectedAdmin(admin)}
                              className="text-xs sm:text-sm h-8 sm:h-9"
                              disabled={isDeletingAdmin}
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              <span className="hidden sm:inline">Delete</span>
                              <span className="sm:hidden">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="sm:max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-lg sm:text-xl text-red-600">
                                Delete Admin Account
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
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                  Create Super Admin
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Create a new super administrator account
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                    <Input
                      id="fullName"
                      value={superAdminForm.fullName}
                      onChange={(e) => setSuperAdminForm({ ...superAdminForm, fullName: e.target.value })}
                      placeholder="Enter full name"
                      className="h-10 sm:h-11 text-sm sm:text-base"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={superAdminForm.email}
                      onChange={(e) => setSuperAdminForm({ ...superAdminForm, email: e.target.value })}
                      placeholder="superadmin@example.com"
                      className="h-10 sm:h-11 text-sm sm:text-base"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={superAdminForm.password}
                      onChange={(e) => setSuperAdminForm({ ...superAdminForm, password: e.target.value })}
                      placeholder="Enter password (min 8 characters)"
                      className="h-10 sm:h-11 text-sm sm:text-base"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={superAdminForm.confirmPassword}
                      onChange={(e) => setSuperAdminForm({ ...superAdminForm, confirmPassword: e.target.value })}
                      placeholder="Confirm password"
                      className="h-10 sm:h-11 text-sm sm:text-base"
                    />
                  </div>
                  
                  <Button
                    onClick={createSuperAdmin}
                    disabled={isCreatingSuperAdmin || !superAdminForm.email || !superAdminForm.password || !superAdminForm.fullName || superAdminForm.password !== superAdminForm.confirmPassword}
                    className="w-full h-10 sm:h-11 text-sm sm:text-base font-medium"
                  >
                    {isCreatingSuperAdmin ? 'Creating...' : 'Create Super Admin'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
