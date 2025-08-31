'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Loader2, Shield } from 'lucide-react';

interface SharedAdminGuardProps {
  children: React.ReactNode;
}

export function SharedAdminGuard({ children }: SharedAdminGuardProps) {
  const { user, loading, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        console.log('SharedAdminGuard: No user, setting isVerifying to false');
        setIsVerifying(false);
        return;
      }

      console.log('SharedAdminGuard: Checking access for user:', user.email);

      try {
        // Check if user is either a commissioner or super admin
        const isSuperAdmin = await verifyAdminStatus(true);
        const isCommissioner = await verifyAdminStatus(false);
        
        console.log('SharedAdminGuard: Super admin status:', isSuperAdmin);
        console.log('SharedAdminGuard: Commissioner status:', isCommissioner);
        
        setHasAccess(isSuperAdmin || isCommissioner);
      } catch (error) {
        console.error('SharedAdminGuard: Error verifying access:', error);
        setHasAccess(false);
      } finally {
        setIsVerifying(false);
      }
    };

    if (!loading) {
      checkAccess();
    }
  }, [user, loading, verifyAdminStatus]);

  useEffect(() => {
    if (!isVerifying && !hasAccess) {
      console.log('SharedAdminGuard: Redirecting to login - isVerifying:', isVerifying, 'hasAccess:', hasAccess);
      // Redirect to login if not authenticated or not an admin/commissioner
      router.push('/login');
    }
  }, [isVerifying, hasAccess, router]);

  // Show loading while verifying
  if (loading || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Show access denied if not authorized
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Render children if user is authenticated and has access
  return <>{children}</>;
}
