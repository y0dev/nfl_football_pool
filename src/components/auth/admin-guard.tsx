'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Loader2, Shield } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}

export function AdminGuard({ children, requireSuperAdmin = false }: AdminGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const verifyAdminStatus = async () => {
      if (!user) {
        setIsVerifying(false);
        return;
      }

      try {
        // Use the service role client to bypass RLS for admin verification
        const { getSupabaseServiceClient } = await import('@/lib/supabase');
        const supabase = getSupabaseServiceClient();
        
        const { data: admin, error } = await supabase
          .from('admins')
          .select('id, is_active, is_super_admin')
          .eq('id', user.id)
          .eq('is_active', true)
          .single();

        if (error || !admin) {
          console.error('User is not an admin:', error);
          setIsAdmin(false);
        } else if (requireSuperAdmin && !admin.is_super_admin) {
          console.error('User is not a super admin');
          setIsAdmin(false);
        } else {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error('Error verifying admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsVerifying(false);
      }
    };

    if (!loading) {
      verifyAdminStatus();
    }
  }, [user, loading, requireSuperAdmin]);

  useEffect(() => {
    if (!isVerifying && !isAdmin) {
      // Redirect to admin login if not authenticated or not an admin
      router.push('/admin/login');
    }
  }, [isVerifying, isAdmin, router]);

  // Show loading while verifying
  if (loading || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Show access denied if not an admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
          <button
            onClick={() => router.push('/admin/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Admin Login
          </button>
        </div>
      </div>
    );
  }

  // Render children if user is authenticated and is an admin
  return <>{children}</>;
}
