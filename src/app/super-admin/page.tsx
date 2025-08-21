'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, Plus, LogOut } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';


function SuperAdminContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSuperAdmin, setIsCreatingSuperAdmin] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();

  // Redirect if user is not logged in or not a super admin
  useEffect(() => {
    if (user && !user.is_super_admin) {
      router.push('/admin/dashboard');
    }
  }, [user, router]);

  // Form states for creating super admin
  const [superAdminForm, setSuperAdminForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });

  // Set loading to false on mount
  useEffect(() => {
    setIsLoading(false);
  }, []);

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

  const handleLogout = async () => {
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      router.push('/admin/login');
    } catch (error) {
      console.error('Error logging out:', error);
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
                <h1 className="text-2xl sm:text-3xl font-bold">Super Admin Dashboard</h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600">Manage admin accounts and system settings</p>
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
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Logout</span>
                  <span className="sm:hidden">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
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
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  return (
    <AuthProvider>
      <AdminGuard requireSuperAdmin={true}>
        <SuperAdminContent />
      </AdminGuard>
    </AuthProvider>
  );
}
