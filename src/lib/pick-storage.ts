export interface StoredPick {
  participant_id: string;
  pool_id: string;
  game_id: string;
  predicted_winner: string;
  confidence_points: number;
  timestamp: number;
}

export interface StoredPicksData {
  picks: StoredPick[];
  participant_id: string;
  pool_id: string;
  week: number;
  lastSaved: number;
  expiresAt: number;
}

const PICK_STORAGE_KEY = 'nfl_pool_draft_picks';
const AUTO_SUBMIT_DELAY = 5 * 60 * 1000; // 5 minutes in milliseconds

export class PickStorage {
  private static instance: PickStorage;
  private autoSubmitTimer: NodeJS.Timeout | null = null;

  static getInstance(): PickStorage {
    if (!PickStorage.instance) {
      PickStorage.instance = new PickStorage();
    }
    return PickStorage.instance;
  }

  // Save picks to localStorage
  savePicks(picks: StoredPick[], participant_id: string, pool_id: string, week: number): void {
    if (typeof window === 'undefined') return;

    const data: StoredPicksData = {
      picks,
      participant_id,
      pool_id,
      week,
      lastSaved: Date.now(),
      expiresAt: Date.now() + AUTO_SUBMIT_DELAY
    };

    localStorage.setItem(PICK_STORAGE_KEY, JSON.stringify(data));
    
    // Set up auto-submit timer
    this.setupAutoSubmit(data);
    
    console.log('💾 Picks saved to localStorage:', picks.length, 'picks');
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

      // Check if data has expired
      if (Date.now() > data.expiresAt) {
        this.clearPicks();
        return [];
      }

      console.log('📂 Loaded picks from localStorage:', data.picks.length, 'picks');
      return data.picks;
    } catch (error) {
      console.error('Error loading picks from localStorage:', error);
      return [];
    }
  }

  // Clear picks from localStorage
  clearPicks(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(PICK_STORAGE_KEY);
    this.clearAutoSubmitTimer();
    console.log('🗑️ Picks cleared from localStorage');
  }

  // Get time remaining until auto-submit
  getTimeRemaining(): number {
    if (typeof window === 'undefined') return 0;

    try {
      const stored = localStorage.getItem(PICK_STORAGE_KEY);
      if (!stored) return 0;

      const data: StoredPicksData = JSON.parse(stored);
      const remaining = data.expiresAt - Date.now();
      return Math.max(0, remaining);
    } catch (error) {
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
    } catch (error) {
      return false;
    }
  }

  // Set up auto-submit timer
  private setupAutoSubmit(data: StoredPicksData): void {
    this.clearAutoSubmitTimer();
    
    const timeRemaining = data.expiresAt - Date.now();
    if (timeRemaining > 0) {
      this.autoSubmitTimer = setTimeout(() => {
        this.autoSubmitPicks(data);
      }, timeRemaining);
    }
  }

  // Clear auto-submit timer
  private clearAutoSubmitTimer(): void {
    if (this.autoSubmitTimer) {
      clearTimeout(this.autoSubmitTimer);
      this.autoSubmitTimer = null;
    }
  }

  // Auto-submit picks when timer expires
  private async autoSubmitPicks(data: StoredPicksData): Promise<void> {
    try {
      console.log('⏰ Auto-submitting picks after 5 minutes...');
      
      // Import the submitPicks function dynamically to avoid circular dependencies
      const { submitPicks } = await import('@/actions/submitPicks');
      
      const result = await submitPicks(data.picks);
      
      if (result.success) {
        console.log('✅ Picks auto-submitted successfully');
        this.clearPicks();
      } else {
        console.error('❌ Auto-submit failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Error during auto-submit:', error);
    }
  }

  // Update expiration time (called when user makes changes)
  updateExpiration(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(PICK_STORAGE_KEY);
      if (!stored) return;

      const data: StoredPicksData = JSON.parse(stored);
      data.expiresAt = Date.now() + AUTO_SUBMIT_DELAY;
      data.lastSaved = Date.now();
      
      localStorage.setItem(PICK_STORAGE_KEY, JSON.stringify(data));
      this.setupAutoSubmit(data);
    } catch (error) {
      console.error('Error updating expiration:', error);
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
