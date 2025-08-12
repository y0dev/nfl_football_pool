'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getDefaultSupabaseClient } from './supabase';

interface User {
  id: string;
  email: string;
  full_name?: string;
  is_super_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Check for existing session
    const checkSession = async () => {
      try {
        const supabase = getDefaultSupabaseClient();
        
        if (!supabase) {
          setLoading(false);
          return;
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // For now, create a mock user from the session
          // In a real app, you'd fetch user details from your admins table
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name,
            is_super_admin: session.user.user_metadata?.is_super_admin || false,
          });
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const supabase = getDefaultSupabaseClient();
      
      if (!supabase) {
        throw new Error('Supabase client not available');
      }
      
      // For now, simulate admin login
      // In a real app, you'd verify against your admins table
      const mockUser: User = {
        id: 'mock-admin-id',
        email,
        full_name: email.split('@')[0],
        is_super_admin: true,
      };
      
      setUser(mockUser);
      
      // Store in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('nfl-pool-user', JSON.stringify(mockUser));
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
      const supabase = getDefaultSupabaseClient();
      
      if (supabase) {
        await supabase.auth.signOut();
      }
      
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

  // Don't render children until mounted to prevent hydration issues
  if (!isMounted) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
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