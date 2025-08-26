import { debugLog } from '@/lib/utils';

// Secure user session management without passwords
export interface UserSession {
  userId: string;
  userName: string;
  poolId: string;
  poolName: string;
  createdAt: string;
  expiresAt: string;
  accessCode: string;
}

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const SESSION_KEY = 'nfl_pool_user_session';

class UserSessionManager {
  private sessions: Map<string, UserSession> = new Map();
  private static instance: UserSessionManager | null = null;
  private initialized = false;

  private constructor() {
    // Only initialize on client side
    if (typeof window !== 'undefined') {
      this.loadSessionsFromStorage();
    }
  }

  public static getInstance(): UserSessionManager {
    if (!UserSessionManager.instance) {
      UserSessionManager.instance = new UserSessionManager();
    }
    return UserSessionManager.instance;
  }

  private loadSessionsFromStorage(): void {
    if (typeof window === 'undefined' || this.initialized) return;
    
    try {
      const sessionsData = localStorage.getItem(SESSION_KEY);
      if (sessionsData) {
        debugLog('Loading sessions from storage:', sessionsData);
        const sessionsObj = JSON.parse(sessionsData);
        debugLog('Parsed sessions object:', sessionsObj);
        this.sessions = new Map(Object.entries(sessionsObj));
      }
    } catch (error) {
      console.error('Failed to load sessions from storage:', error);
    }
    this.initialized = true;
  }

  private saveSessionsToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      debugLog('Saving sessions to storage:', this.sessions);
      const sessionsObj = Object.fromEntries(this.sessions);
      debugLog('Sessions object:', sessionsObj);
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionsObj));
    } catch (error) {
      console.error('Failed to save sessions to storage:', error);
    }
  }

  public createSession(
    userId: string,
    userName: string,
    poolId: string,
    poolName: string,
    accessCode: string
  ): UserSession {
    if (typeof window === 'undefined') {
      throw new Error('UserSessionManager cannot be used on server side');
    }

    if (!this.initialized) {
      this.loadSessionsFromStorage();
    }

    const sessionKey = `${userId}-${poolId}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION);

    const session: UserSession = {
      userId,
      userName,
      poolId,
      poolName,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      accessCode
    };

    this.sessions.set(sessionKey, session);
    this.saveSessionsToStorage();

    return session;
  }

  public getSession(userId: string, poolId: string): UserSession | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!this.initialized) {
      this.loadSessionsFromStorage();
    }

    const sessionKey = `${userId}-${poolId}`;
    const session = this.sessions.get(sessionKey);

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (new Date() > new Date(session.expiresAt)) {
      this.sessions.delete(sessionKey);
      this.saveSessionsToStorage();
      return null;
    }

    return session;
  }

  public removeSession(userId: string, poolId: string): void {
    if (typeof window === 'undefined') return;

    if (!this.initialized) {
      this.loadSessionsFromStorage();
    }

    const sessionKey = `${userId}-${poolId}`;
    this.sessions.delete(sessionKey);
    this.saveSessionsToStorage();
  }

  public extendSession(userId: string, poolId: string): boolean {
    if (typeof window === 'undefined') return false;

    if (!this.initialized) {
      this.loadSessionsFromStorage();
    }

    const session = this.getSession(userId, poolId);
    if (!session) {
      return false;
    }

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + SESSION_DURATION);
    session.expiresAt = newExpiresAt.toISOString();

    const sessionKey = `${userId}-${poolId}`;
    this.sessions.set(sessionKey, session);
    this.saveSessionsToStorage();

    return true;
  }

  public isSessionValid(userId: string, poolId: string): boolean {
    if (typeof window === 'undefined') return false;

    if (!this.initialized) {
      this.loadSessionsFromStorage();
    }

    const session = this.getSession(userId, poolId);
    return session !== null;
  }

  public getAllSessions(): UserSession[] {
    if (typeof window === 'undefined') return [];

    if (!this.initialized) {
      this.loadSessionsFromStorage();
    }

    return Array.from(this.sessions.values());
  }

  public clearAllSessions(): void {
    if (typeof window === 'undefined') return;

    this.sessions.clear();
    this.saveSessionsToStorage();
  }

  public cleanupExpiredSessions(): void {
    if (typeof window === 'undefined') return;

    if (!this.initialized) {
      this.loadSessionsFromStorage();
    }

    const now = new Date();
    let hasExpired = false;

    for (const [key, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt) <= now) {
        this.sessions.delete(key);
        hasExpired = true;
      }
    }

    if (hasExpired) {
      this.saveSessionsToStorage();
    }
  }
}

// Export singleton instance
export const userSessionManager = UserSessionManager.getInstance();
