'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { clearSessionCookie } from '@/actions/sessionCookie';
import { debugLog, debugError, debugWarn } from '@/lib/utils';

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

  // In-memory only — resets on every page refresh so it cannot be spoofed
  // from cookie or localStorage. Never persisted to client storage.
  const adminVerifiedAt = useRef<number | null>(null);
  const ADMIN_VERIFY_CACHE_MS = 5 * 60 * 1000;

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

      // Persist to localStorage WITHOUT is_super_admin — that field is only
      // trusted when verified from the database via verifyAdminStatus.
      const persistableData = {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        signedInAt: Date.now(),
      };

      // React state gets is_super_admin in-memory (ephemeral, not from storage)
      setUser({ ...persistableData, is_super_admin: userData.is_super_admin });

      if (typeof window !== 'undefined') {
        localStorage.setItem('nfl-pool-user', JSON.stringify(persistableData));
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
      if (typeof window !== 'undefined') localStorage.removeItem('nfl-pool-user');
      // Clear the httpOnly session cookie used by middleware
      await clearSessionCookie();
    } catch (error) {
      debugError('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  // DB-backed admin verification. Uses a short in-memory cache (resets on every
  // page refresh) so repeated calls within the same page don't hammer the DB.
  // is_super_admin is NEVER read from cookie or localStorage — only from this
  // function's DB result, preventing client-side privilege escalation.
  const verifyAdminStatus = useCallback(async (requireSuperAdmin = false): Promise<boolean> => {
    if (!user) return false;

    if (isTestAccountBlocked) {
      debugWarn('Blocked test account attempting to verify admin status:', user.email);
      await signOut();
      return false;
    }

    // In-memory cache only — populated by DB result below, never from storage
    if (
      adminVerifiedAt.current !== null &&
      Date.now() - adminVerifiedAt.current < ADMIN_VERIFY_CACHE_MS &&
      user.is_super_admin !== undefined
    ) {
      debugLog('[Auth:verifyAdminStatus] using in-memory cache — is_super_admin:', user.is_super_admin);
      return requireSuperAdmin ? user.is_super_admin === true : true;
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

      debugLog('[Auth:verifyAdminStatus] DB result — found:', !!admin, '| is_super_admin:', admin?.is_super_admin);

      if (error || !admin) return false;

      adminVerifiedAt.current = Date.now();

      // Set is_super_admin in React state only — do NOT persist to localStorage
      setUser((prev) => prev ? { ...prev, is_super_admin: admin.is_super_admin } : prev);

      return requireSuperAdmin ? admin.is_super_admin === true : true;
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
          debugLog('[Auth:checkSession] all cookies:', document.cookie || '(none)');

          // Check for server-set OAuth session cookie first (from /auth/callback route handler)
          const cookieMatch = document.cookie.match(/(?:^|;\s*)nfl-pool-session=([^;]*)/);
          debugLog('[Auth:checkSession] nfl-pool-session cookie match:', !!cookieMatch);

          if (cookieMatch) {
            try {
              const serverUser = JSON.parse(decodeURIComponent(cookieMatch[1]));
              debugLog('[Auth:checkSession] parsed session cookie — user:', serverUser.email);
              // Consume the cookie — one-time handoff from server to localStorage
              document.cookie = 'nfl-pool-session=;path=/;max-age=0';
              // Strip is_super_admin — it must be verified from DB, never from a cookie
              const { is_super_admin: _sa, ...safeServerUser } = serverUser;
              localStorage.setItem('nfl-pool-user', JSON.stringify(safeServerUser));
              setUser(safeServerUser); // is_super_admin starts undefined; verifyAdminStatus sets it
              setLoading(false);
              debugLog('[Auth:checkSession] session set from cookie (is_super_admin stripped), done');
              return;
            } catch (e) {
              debugError('[Auth:checkSession] failed to parse session cookie:', e);
              document.cookie = 'nfl-pool-session=;path=/;max-age=0';
            }
          }

          const storedUser = localStorage.getItem('nfl-pool-user');
          debugLog('[Auth:checkSession] localStorage nfl-pool-user:', storedUser ? 'found' : 'not found');

          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            debugLog('[Auth:checkSession] localStorage user:', parsedUser.email, '| signedInAt:', parsedUser.signedInAt ? new Date(parsedUser.signedInAt).toISOString() : 'unknown');

            // Expire sessions older than 90 days
            if (parsedUser.signedInAt && Date.now() - parsedUser.signedInAt > SESSION_MAX_MS) {
              debugLog('[Auth:checkSession] session expired, clearing');
              localStorage.removeItem('nfl-pool-user');
              setLoading(false);
              return;
            }

            const isBlocked = checkTestAccountSecurity(parsedUser);
            if (isBlocked) {
              await signOut();
              return;
            }

            // Strip is_super_admin even if somehow present in localStorage
            setUser({
              id: parsedUser.id,
              email: parsedUser.email,
              full_name: parsedUser.full_name,
              signedInAt: parsedUser.signedInAt,
              // is_super_admin intentionally absent — verifyAdminStatus will set it from DB
            });
            debugLog('[Auth:checkSession] session restored from localStorage (is_super_admin deferred to DB)');
          } else {
            debugLog('[Auth:checkSession] no session found anywhere — user is logged out');
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