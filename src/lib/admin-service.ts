import { getSupabaseServiceClient } from './supabase';
import { debugLog, debugError } from './utils';

export interface DashboardStats {
  totalPools: number;
  activePools: number;
  totalParticipants: number;
  totalGames: number;
  pendingSubmissions: number;
  completedSubmissions: number;
}

export interface Pool {
  id: string;
  name: string;
  created_by: string;
  season: number;
  is_active: boolean;
  created_at: string;
  tie_breaker_method?: string;
  tie_breaker_question?: string;
  tie_breaker_answer?: number;
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  pool_id: string;
  is_active: boolean;
  created_at: string;
}

export interface Admin {
  id: string;
  email: string;
  full_name?: string;
  is_super_admin: boolean;
  is_active: boolean;
  created_at: string;
}

/**
 * Admin Service - Centralized service for admin operations using service role client
 * Only includes functions that are actually being used in the application
 */
export class AdminService {
  private static instance: AdminService;
  private supabase: ReturnType<typeof getSupabaseServiceClient>;

  private constructor() {
    this.supabase = getSupabaseServiceClient();
    debugLog('AdminService: Service role client initialized');
    
          // Test the connection
      this.testConnection().catch(error => {
        debugError('AdminService: Connection test failed:', error);
      });
  }
  
  private async testConnection() {
    try {
      debugLog('AdminService: Testing database connection...');
      const { data, error } = await this.supabase
        .from('admins')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        debugError('AdminService: Connection test failed:', error);
      } else {
        debugLog('AdminService: Connection test successful');
      }
    } catch (error) {
      debugError('AdminService: Connection test error:', error);
    }
  }

  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      debugLog('AdminService: Creating new instance');
      AdminService.instance = new AdminService();
    } else {
      debugLog('AdminService: Returning existing instance');
    }
    return AdminService.instance;
  }

  /**
   * Get dashboard statistics for an admin
   */
  async getDashboardStats(
    currentWeek: number,
    currentSeasonType: number,
    adminEmail: string,
    isSuperAdmin: boolean = false
  ): Promise<DashboardStats> {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('AdminService: Getting dashboard stats for:', { adminEmail, isSuperAdmin });
      }

      let poolsQuery = this.supabase
        .from('pools')
        .select('*')
        .eq('is_active', true);

      if (!isSuperAdmin) {
        poolsQuery = poolsQuery.eq('created_by', adminEmail);
      }

      const { data: pools, error: poolsError } = await poolsQuery.order('created_at', { ascending: false });

      if (poolsError) {
        debugError('AdminService: Error fetching pools:', poolsError);
        throw poolsError;
      }

      debugLog('AdminService: Pools query result:', { data: pools, error: poolsError });

      // Get participants
      let participantsQuery = this.supabase
        .from('participants')
        .select('id, is_active, pool_id');

      if (!isSuperAdmin && pools) {
        const poolIds = pools.map(p => p.id);
        if (process.env.NODE_ENV === 'development') {
          console.log('AdminService: Filtering participants by pool IDs:', poolIds);
        }
        participantsQuery = participantsQuery.in('pool_id', poolIds);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('AdminService: Executing participants query...');
      }
      const { data: participants, error: participantsError } = await participantsQuery;
      if (process.env.NODE_ENV === 'development') {
        console.log('AdminService: Participants query result:', { data: participants, error: participantsError });
      }
      
      if (participantsError) throw new Error(`Failed to load participants: ${participantsError.message}`);

      // Get games
      if (process.env.NODE_ENV === 'development') {
        console.log('AdminService: Executing games query...');
      }
      const { data: games, error: gamesError } = await this.supabase
        .from('games')
        .select('id, week, season_type')
        .eq('week', currentWeek)
        .eq('season_type', currentSeasonType);

      if (process.env.NODE_ENV === 'development') {
        console.log('AdminService: Games query result:', { data: games, error: gamesError });
      }
      
      if (gamesError) throw new Error(`Failed to load games: ${gamesError.message}`);

      // Get picks for submission stats
      let picksQuery = this.supabase
        .from('picks')
        .select('participant_id, pool_id, games!inner(week, season_type)')
        .eq('games.week', currentWeek)
        .eq('games.season_type', currentSeasonType);

      if (!isSuperAdmin && pools) {
        const poolIds = pools.map(p => p.id);
        if (process.env.NODE_ENV === 'development') {
          console.log('AdminService: Filtering picks by pool IDs:', poolIds);
        }
        picksQuery = picksQuery.in('pool_id', poolIds);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('AdminService: Executing picks query...');
      }
      const { data: picks, error: picksError } = await picksQuery;
      if (process.env.NODE_ENV === 'development') {
        console.log('AdminService: Picks query result:', { data: picks, error: picksError });
      }
      
      if (picksError) throw new Error(`Failed to load picks: ${picksError.message}`);

      // Calculate stats
      const totalPools = pools?.length || 0;
      const activePools = pools?.filter(p => p.is_active).length || 0;
      const totalParticipants = participants?.filter(p => p.is_active).length || 0;
      const totalGames = games?.length || 0;
      const completedSubmissions = new Set(picks?.map(p => p.participant_id)).size;
      const pendingSubmissions = totalParticipants - completedSubmissions;

      const stats = {
        totalPools,
        activePools,
        totalParticipants,
        totalGames,
        pendingSubmissions,
        completedSubmissions
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('AdminService: Calculated dashboard stats:', stats);
      }
      return stats;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('AdminService: Error getting dashboard stats:', error);
      }
      throw error;
    }
  }

  /**
   * Get active pools for an admin (used in dashboard)
   */
  async getActivePools(adminEmail: string, isSuperAdmin: boolean): Promise<Pool[]> {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('AdminService: Getting active pools for:', { adminEmail, isSuperAdmin });
      }

      let query = this.supabase
        .from('pools')
        .select('*')
        .eq('is_active', true);

      if (!isSuperAdmin) {
        query = query.eq('created_by', adminEmail);
      }

      const { data: pools, error } = await query.order('created_at', { ascending: false });
        
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('AdminService: Active pools query error:', error);
        }
        throw new Error(`Failed to load active pools: ${error.message}`);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('AdminService: Active pools result:', { count: pools?.length || 0 });
      }

      return pools || [];
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('AdminService: Error getting active pools:', error);
      }
      throw error;
    }
  }

  /**
   * Get participants for a pool (used in adminActions)
   */
  async getPoolParticipants(poolId: string): Promise<Participant[]> {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('AdminService: Getting participants for pool:', poolId);
      }

      const { data: participants, error } = await this.supabase
        .from('participants')
        .select('*')
        .eq('pool_id', poolId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('AdminService: Participants query error:', error);
        }
        throw new Error(`Failed to load participants: ${error.message}`);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('AdminService: Pool participants result:', { count: participants?.length || 0 });
      }

      return participants || [];
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('AdminService: Error getting pool participants:', error);
      }
      throw error;
    }
  }

  /**
   * Get all admins (used in dashboard for admin)
   */
  async getAdmins(): Promise<Admin[]> {
    try {
      debugLog('Function: getAdmins - Getting all admins');

      debugLog('AdminService: Executing query: SELECT * FROM admins ORDER BY full_name');
      
      // First, let's check if the table exists and has any data
      const { count: tableCount, error: countError } = await this.supabase
        .from('admins')
        .select('id', { count: 'exact', head: true });
      
      debugLog('AdminService: Table count check:', { count: tableCount, error: countError });
      
      // Let's also check the table structure
      try {
        const { data: sampleData, error: sampleError } = await this.supabase
          .from('admins')
          .select('id, email, full_name, is_super_admin, is_active, created_at')
          .limit(1);
        
        debugLog('AdminService: Sample data check:', { data: sampleData, error: sampleError });
      } catch (sampleError) {
        debugError('AdminService: Sample data check failed:', sampleError);
      }
      
      const { data: admins, error } = await this.supabase
        .from('admins')
        .select('id, email, full_name, is_super_admin, is_active, created_at')
        .order('full_name');

      debugLog('AdminService: Raw query result:', { data: admins, error });

      if (error) {
        debugError('AdminService: Admins query error:', error);
        debugError('AdminService: Error details:', { 
          message: error.message, 
          details: error.details, 
          hint: error.hint,
          code: error.code 
        });
        throw new Error(`Failed to load admins: ${error.message}`);
      }

      debugLog('AdminService: Admins result:', { count: admins?.length || 0, admins });
      
      // Let's also check if the data has the expected structure
      if (admins && admins.length > 0) {
        debugLog('AdminService: First admin data structure:', {
          id: admins[0].id,
          email: admins[0].email,
          full_name: admins[0].full_name,
          is_super_admin: admins[0].is_super_admin,
          is_active: admins[0].is_active,
          created_at: admins[0].created_at
        });
      }

      return admins || [];
    } catch (error) {
      debugError('AdminService: Error getting admins:', error);
      if (error instanceof Error) {
        debugError('AdminService: Error type:', typeof error);
        debugError('AdminService: Error message:', error.message);
        debugError('AdminService: Error stack:', error.stack);
      }
      throw error;
    }
  }
}

// Export singleton instance
export const adminService = AdminService.getInstance();
