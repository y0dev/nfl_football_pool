'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Key, Plus, RefreshCw, Trash2, Eye, EyeOff } from 'lucide-react';
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
          </div>
          <p className="text-gray-600">Manage admin accounts and system settings</p>
        </div>

        <Tabs defaultValue="admins" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="admins">Manage Admins</TabsTrigger>
            <TabsTrigger value="create">Create Super Admin</TabsTrigger>
          </TabsList>

          <TabsContent value="admins" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Admin Accounts
                </CardTitle>
                <CardDescription>
                  View and manage all admin accounts in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {admins.map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <h3 className="font-semibold">{admin.full_name}</h3>
                            <p className="text-sm text-gray-600">{admin.email}</p>
                          </div>
                          <div className="flex gap-2">
                            {admin.is_super_admin && (
                              <Badge variant="default">Super Admin</Badge>
                            )}
                            <Badge variant={admin.is_active ? "default" : "secondary"}>
                              {admin.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(admin.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedAdmin(admin)}
                            >
                              <Key className="h-4 w-4 mr-2" />
                              Reset Password
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reset Password for {admin.full_name}</DialogTitle>
                              <DialogDescription>
                                Enter a new password for {admin.email}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="newPassword">New Password</Label>
                                <div className="relative">
                                  <Input
                                    id="newPassword"
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
                            >
                              {admin.is_active ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {admin.is_active ? 'Deactivate' : 'Activate'} Admin
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to {admin.is_active ? 'deactivate' : 'activate'} {admin.full_name}?
                                {admin.is_active ? ' They will no longer be able to access the admin dashboard.' : ' They will be able to access the admin dashboard again.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => toggleAdminStatus(admin)}
                                className={admin.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                              >
                                {admin.is_active ? 'Deactivate' : 'Activate'}
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

          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Create Super Admin
                </CardTitle>
                <CardDescription>
                  Create a new super administrator account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={superAdminForm.fullName}
                      onChange={(e) => setSuperAdminForm({ ...superAdminForm, fullName: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={superAdminForm.email}
                      onChange={(e) => setSuperAdminForm({ ...superAdminForm, email: e.target.value })}
                      placeholder="superadmin@example.com"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={superAdminForm.password}
                      onChange={(e) => setSuperAdminForm({ ...superAdminForm, password: e.target.value })}
                      placeholder="Enter password (min 8 characters)"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={superAdminForm.confirmPassword}
                      onChange={(e) => setSuperAdminForm({ ...superAdminForm, confirmPassword: e.target.value })}
                      placeholder="Confirm password"
                    />
                  </div>
                  
                  <Button
                    onClick={createSuperAdmin}
                    disabled={isCreatingSuperAdmin || !superAdminForm.email || !superAdminForm.password || !superAdminForm.fullName || superAdminForm.password !== superAdminForm.confirmPassword}
                    className="w-full"
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
