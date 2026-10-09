import { StoredPick } from '@/types/game';
import { debugLog, debugError } from '@/lib/utils';

/** Context needed to auto-save a draft to the server — season/seasonType
 * aren't on StoredPick itself, and mondayNightScore is tracked separately
 * in WeeklyPick's own state. Optional: if omitted (a caller that doesn't
 * pass it), the local-only save still happens, but the 2-minute timer has
 * nothing it can safely POST to the draft endpoint, so it's skipped. */
interface DraftSaveContext {
  season: number;
  seasonType: number;
  mondayNightScore?: number | null;
}

interface StoredPicksData {
  picks: StoredPick[];
  participant_id: string;
  pool_id: string;
  week: number;
  lastSaved: number;
  expiresAt: number;
  draftContext?: DraftSaveContext;
}

const PICK_STORAGE_KEY = 'nfl_pool_draft_picks';
// How long a participant can go without changing anything or submitting
// before their in-progress picks get auto-saved as a server-side draft a
// commissioner can pick up and submit for them (src/actions/savePickDraft.ts).
// Deliberately does NOT submit real picks on its own — see the removed
// auto-submit behavior this replaced; silently finalizing someone's picks
// without their consent was the actual problem being fixed here.
const AUTO_DRAFT_DELAY = 2 * 60 * 1000; // 2 minutes in milliseconds

class PickStorage {
  private static instance: PickStorage;
  private autoDraftTimer: NodeJS.Timeout | null = null;

  static getInstance(): PickStorage {
    if (!PickStorage.instance) {
      PickStorage.instance = new PickStorage();
    }
    return PickStorage.instance;
  }

  // Save picks to localStorage
  savePicks(picks: StoredPick[], participant_id: string, pool_id: string, week: number, draftContext?: DraftSaveContext): void {
    if (typeof window === 'undefined') return;

    const data: StoredPicksData = {
      picks,
      participant_id,
      pool_id,
      week,
      lastSaved: Date.now(),
      expiresAt: Date.now() + AUTO_DRAFT_DELAY,
      draftContext,
    };

    localStorage.setItem(PICK_STORAGE_KEY, JSON.stringify(data));

    // Set up the auto-draft-save timer
    this.setupAutoDraft(data);

    debugLog('💾 Picks saved to localStorage:', picks.length, 'picks');
  }

  // Load picks from localStorage
  loadPicks(participant_id: string, pool_id: string, week: number): StoredPick[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(PICK_STORAGE_KEY);
      if (!stored) return [];

      const data: StoredPicksData = JSON.parse(stored);
      
      // Check if data is for the same user, pool, and week
      if (data.participant_id !== participant_id || 
          data.pool_id !== pool_id || 
          data.week !== week) {
        return [];
      }

      // // Check if data has expired
      // if (Date.now() > data.expiresAt) {
      //   this.clearPicks();
      //   return [];
      // }

      debugLog('📂 Loaded picks from localStorage:', data.picks.length, 'picks');
      return data.picks;
    } catch (error) {
      debugError('Error loading picks from localStorage:', error);
      return [];
    }
  }

  // Clear picks from localStorage
  clearPicks(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(PICK_STORAGE_KEY);
    this.clearAutoDraftTimer();
    debugLog('🗑️ Picks cleared from localStorage');
  }

  // Get time remaining until the draft auto-save
  getTimeRemaining(): number {
    if (typeof window === 'undefined') return 0;

    try {
      const stored = localStorage.getItem(PICK_STORAGE_KEY);
      if (!stored) return 0;

      const data: StoredPicksData = JSON.parse(stored);
      const remaining = data.expiresAt - Date.now();
      return Math.max(0, remaining);
    } catch {
      return 0;
    }
  }

  // Check if picks exist and are valid
  hasValidPicks(participant_id: string, pool_id: string, week: number): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const stored = localStorage.getItem(PICK_STORAGE_KEY);
      if (!stored) return false;

      const data: StoredPicksData = JSON.parse(stored);
      
      return data.participant_id === participant_id && 
             data.pool_id === pool_id && 
             data.week === week &&
             Date.now() <= data.expiresAt &&
             data.picks.length > 0;
    } catch {
      return false;
    }
  }

  // Set up the auto-draft-save timer
  private setupAutoDraft(data: StoredPicksData): void {
    this.clearAutoDraftTimer();

    const timeRemaining = data.expiresAt - Date.now();
    if (timeRemaining > 0) {
      this.autoDraftTimer = setTimeout(() => {
        this.saveDraftToServer(data);
      }, timeRemaining);
    }
  }

  // Clear the auto-draft-save timer
  private clearAutoDraftTimer(): void {
    if (this.autoDraftTimer) {
      clearTimeout(this.autoDraftTimer);
      this.autoDraftTimer = null;
    }
  }

  // Save a draft to the server when the inactivity timer expires — the
  // participant's local in-progress state (localStorage) is left alone so
  // they can still resume and submit for real if they come back.
  private async saveDraftToServer(data: StoredPicksData): Promise<void> {
    if (!data.draftContext) {
      debugLog('⏭️ Skipping auto-draft-save — no season/seasonType context available');
      return;
    }
    try {
      debugLog('⏰ Auto-saving draft after 2 minutes of inactivity...');

      // Import dynamically to avoid circular dependencies
      const { savePickDraft } = await import('@/actions/savePickDraft');

      const result = await savePickDraft({
        participantId: data.participant_id,
        poolId: data.pool_id,
        week: data.week,
        season: data.draftContext.season,
        seasonType: data.draftContext.seasonType,
        picks: data.picks,
        mondayNightScore: data.draftContext.mondayNightScore ?? null,
      });

      if (result.success) {
        debugLog('✅ Draft auto-saved for the commissioner to review');
      } else {
        debugError('❌ Auto-draft-save failed:', result.error);
      }
    } catch (error) {
      debugError('❌ Error during auto-draft-save:', error);
    }
  }

  // Update expiration time (called when user makes changes)
  updateExpiration(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(PICK_STORAGE_KEY);
      if (!stored) return;

      const data: StoredPicksData = JSON.parse(stored);
      data.expiresAt = Date.now() + AUTO_DRAFT_DELAY;
      data.lastSaved = Date.now();

      localStorage.setItem(PICK_STORAGE_KEY, JSON.stringify(data));
      this.setupAutoDraft(data);
    } catch (error) {
      debugError('Error updating expiration:', error);
    }
  }

  // Get formatted time remaining string
  getFormattedTimeRemaining(): string {
    const remaining = this.getTimeRemaining();
    if (remaining <= 0) return 'Expired';

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

// Export singleton instance
export const pickStorage = PickStorage.getInstance();
