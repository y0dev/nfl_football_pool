'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Loader2, Shield } from 'lucide-react';
import { debugLog } from '@/lib/utils';

interface AdminGuardProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}

export function AdminGuard({ children, requireSuperAdmin = false }: AdminGuardProps) {
  const { user, loading, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        debugLog('AdminGuard: No user, setting isVerifying to false');
        setIsVerifying(false);
        return;
      }

      debugLog('AdminGuard: Checking admin status for user:', user.email);
      debugLog('AdminGuard: User admin status from cache:', user.is_super_admin);
      debugLog('AdminGuard: Require super admin:', requireSuperAdmin);

      try {
        // Use the new server-side verification function
        const adminStatus = await verifyAdminStatus(requireSuperAdmin);
        debugLog('AdminGuard: Admin status after verification:', adminStatus);
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error('AdminGuard: Error verifying admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsVerifying(false);
      }
    };

    if (!loading) {
      checkAdminStatus();
    }
  }, [user, loading, requireSuperAdmin, verifyAdminStatus]);

  useEffect(() => {
    if (!isVerifying && !isAdmin) {
      debugLog('AdminGuard: Redirecting to admin login - isVerifying:', isVerifying, 'isAdmin:', isAdmin);
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
          <p className="text-gray-600 mb-4">You don&apos;t have permission to access this page.</p>
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
