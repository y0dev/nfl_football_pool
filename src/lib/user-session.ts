// Secure user session management without passwords
export interface UserSession {
  participantId: string;
  participantName: string;
  sessionId: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const SESSION_KEY = 'nfl_pool_user_session';

export class UserSessionManager {
  private static instance: UserSessionManager;
  private sessions: Map<string, UserSession> = new Map();

  private constructor() {
    this.loadSessionsFromStorage();
  }

  static getInstance(): UserSessionManager {
    if (!UserSessionManager.instance) {
      UserSessionManager.instance = new UserSessionManager();
    }
    return UserSessionManager.instance;
  }

  // Create a new session for a participant
  createSession(participantId: string, participantName: string): UserSession {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    
    const session: UserSession = {
      participantId,
      participantName,
      sessionId,
      createdAt: now,
      expiresAt: now + SESSION_DURATION
    };

    this.sessions.set(sessionId, session);
    this.saveSessionsToStorage();
    
    return session;
  }

  // Get current active session
  getCurrentSession(): UserSession | null {
    const sessionId = this.getSessionIdFromStorage();
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      this.removeSession(sessionId);
      return null;
    }

    return session;
  }

  // Validate if a user can access a specific participant's data
  canAccessParticipant(participantId: string): boolean {
    const session = this.getCurrentSession();
    return session?.participantId === participantId;
  }

  // Remove a session
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.saveSessionsToStorage();
    this.clearSessionIdFromStorage();
  }

  // Clear current session
  clearCurrentSession(): void {
    const sessionId = this.getSessionIdFromStorage();
    if (sessionId) {
      this.removeSession(sessionId);
    }
  }

  // Extend session (reset expiration)
  extendSession(): void {
    const session = this.getCurrentSession();
    if (session) {
      session.expiresAt = Date.now() + SESSION_DURATION;
      this.sessions.set(session.sessionId, session);
      this.saveSessionsToStorage();
    }
  }

  // Check if session is about to expire (within 1 hour)
  isSessionExpiringSoon(): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;
    
    const oneHour = 60 * 60 * 1000;
    return (session.expiresAt - Date.now()) < oneHour;
  }

  // Generate unique session ID
  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Storage management
  private saveSessionsToStorage(): void {
    try {
      const sessionsData = JSON.stringify(Array.from(this.sessions.entries()));
      localStorage.setItem(SESSION_KEY, sessionsData);
    } catch (error) {
      console.error('Failed to save sessions to storage:', error);
    }
  }

  private loadSessionsFromStorage(): void {
    try {
      const sessionsData = localStorage.getItem(SESSION_KEY);
      if (sessionsData) {
        const sessionsArray = JSON.parse(sessionsData);
        this.sessions = new Map(sessionsArray);
        
        // Clean up expired sessions
        this.cleanupExpiredSessions();
      }
    } catch (error) {
      console.error('Failed to load sessions from storage:', error);
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
      }
    }
    this.saveSessionsToStorage();
  }

  private getSessionIdFromStorage(): string | null {
    try {
      return localStorage.getItem('nfl_pool_current_session');
    } catch (error) {
      return null;
    }
  }

  private setSessionIdInStorage(sessionId: string): void {
    try {
      localStorage.setItem('nfl_pool_current_session', sessionId);
    } catch (error) {
      console.error('Failed to save session ID to storage:', error);
    }
  }

  private clearSessionIdFromStorage(): void {
    try {
      localStorage.removeItem('nfl_pool_current_session');
    } catch (error) {
      console.error('Failed to clear session ID from storage:', error);
    }
  }
}

// Export singleton instance
export const userSessionManager = UserSessionManager.getInstance();
