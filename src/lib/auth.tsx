'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  full_name?: string;
  is_super_admin?: boolean; // Add admin status to user data
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (userData: User) => Promise<void>;
  signOut: () => Promise<void>;
  verifyAdminStatus: (requireSuperAdmin?: boolean) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Check for existing session from localStorage
    const checkSession = async () => {
      try {
        if (typeof window !== 'undefined') {
          const storedUser = localStorage.getItem('nfl-pool-user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            // Restore all user data including admin status
            setUser({
              id: parsedUser.id,
              email: parsedUser.email,
              full_name: parsedUser.full_name,
              is_super_admin: parsedUser.is_super_admin
            });
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const signIn = async (userData: User) => {
    try {
      setLoading(true);
      
      // Store all user data including admin status
      const safeUserData = {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        is_super_admin: userData.is_super_admin
      };
      
      setUser(safeUserData);
      
      // Store in localStorage for persistence (including admin status)
      if (typeof window !== 'undefined') {
        localStorage.setItem('nfl-pool-user', JSON.stringify(safeUserData));
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      setUser(null);
      
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nfl-pool-user');
      }
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Server-side admin verification with caching
  const verifyAdminStatus = useCallback(async (requireSuperAdmin = false): Promise<boolean> => {
    if (!user) return false;
    
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
      console.error('Error verifying admin status:', error);
      return false;
    }
  }, [user]);

  // Don't render children until mounted to prevent hydration issues
  if (!isMounted) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, verifyAdminStatus }}>
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