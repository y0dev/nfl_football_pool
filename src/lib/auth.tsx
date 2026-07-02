'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { debugError, debugWarn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  full_name?: string;
  is_super_admin?: boolean;
  signedInAt?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (userOrEmail: User | string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
  verifyAdminStatus: (requireSuperAdmin?: boolean) => Promise<boolean>;
  isTestAccountBlocked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isTestAccountBlocked, setIsTestAccountBlocked] = useState(false);

  // Security check for test accounts in production
  const checkTestAccountSecurity = (user: User | null) => {
    if (process.env.NODE_ENV === 'production' && user?.email) {
      const testEmails = ['admin@test.com', 'superadmin@test.com'];
      if (testEmails.includes(user.email.toLowerCase())) {
        debugWarn('Test account detected in production:', user.email);
        setIsTestAccountBlocked(true);
        return true; // Account is blocked
      }
    }
    setIsTestAccountBlocked(false);
    return false; // Account is not blocked
  };

const signIn = async (userOrEmail: User | string, password?: string) => {
    try {
      setLoading(true);

      let userData: User;

      if (typeof userOrEmail === 'string') {
        const email = userOrEmail;
        if (password) {
          // Do login with supabase
          const { getSupabaseClient } = await import('./supabase');
          const supabase = getSupabaseClient();
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          if (!data.user) throw new Error('Login failed');

          // Get user profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          userData = {
            id: data.user.id,
            email: data.user.email!,
            full_name: profile?.full_name,
            is_super_admin: profile?.is_super_admin || false,
          };
        } else {
          // For user selection or register, set user with email
          userData = {
            id: email, // dummy id
            email,
            full_name: '',
            is_super_admin: false,
          };
        }
      } else {
        userData = userOrEmail;
      }

      // Check for test account security
      const isBlocked = checkTestAccountSecurity(userData);
      if (isBlocked) {
        debugWarn('Test account detected in production, blocking sign in');
        throw new Error('Test accounts are not allowed in production');
      }

      const safeUserData = {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        is_super_admin: userData.is_super_admin,
        signedInAt: Date.now(),
      };

      setUser(safeUserData);

      if (typeof window !== 'undefined') {
        localStorage.setItem('nfl-pool-user', JSON.stringify(safeUserData));
      }
    } catch (error) {
      debugError('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      setUser(null);
      setIsTestAccountBlocked(false);
      
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nfl-pool-user');
      }
    } catch (error) {
      debugError('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Server-side admin verification with caching
  const verifyAdminStatus = useCallback(async (requireSuperAdmin = false): Promise<boolean> => {
    if (!user) return false;
    
    // Check if test account is blocked
    if (isTestAccountBlocked) {
      debugWarn('Blocked test account attempting to verify admin status:', user.email);
      await signOut();
      return false;
    }

    // If we have cached admin status and it's sufficient, use it
    if (user.is_super_admin !== undefined) {
      if (requireSuperAdmin) {
        return user.is_super_admin === true;
      }
      return true; // Any admin can access non-super-admin pages
    }
    
    try {
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      const { data: admin, error } = await supabase
        .from('admins')
        .select('id, is_active, is_super_admin')
        .eq('id', user.id)
        .eq('is_active', true)
        .single();

      if (error || !admin) {
        return false;
      }
      
      // Update the user state with admin status
      const updatedUser = { ...user, is_super_admin: admin.is_super_admin };
      setUser(updatedUser);
      
      // Update localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('nfl-pool-user', JSON.stringify(updatedUser));
      }
      
      if (requireSuperAdmin && !admin.is_super_admin) {
        return false;
      }
      
      return true;
    } catch (error) {
      debugError('Error verifying admin status:', error);
      return false;
    }
  }, [user, isTestAccountBlocked]);

  useEffect(() => {
    setIsMounted(true);
    
    const SESSION_MAX_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

    const checkSession = async () => {
      try {
        if (typeof window !== 'undefined') {
          const storedUser = localStorage.getItem('nfl-pool-user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);

            // Expire sessions older than 90 days
            if (parsedUser.signedInAt && Date.now() - parsedUser.signedInAt > SESSION_MAX_MS) {
              localStorage.removeItem('nfl-pool-user');
              setLoading(false);
              return;
            }

            const isBlocked = checkTestAccountSecurity(parsedUser);
            if (isBlocked) {
              await signOut();
              return;
            }

            setUser({
              id: parsedUser.id,
              email: parsedUser.email,
              full_name: parsedUser.full_name,
              is_super_admin: parsedUser.is_super_admin,
              signedInAt: parsedUser.signedInAt,
            });
          }
        }
      } catch (error) {
        debugError('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  // Don't render children until mounted to prevent hydration issues
  if (!isMounted) {
    return <div>Loading...</div>;
  }

  const value = {
    user,
    loading,
    signIn,
    signOut,
    verifyAdminStatus,
    isTestAccountBlocked
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 