import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          is_super_admin: boolean
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          is_super_admin?: boolean
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          is_super_admin?: boolean
        }
      }
      pools: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          created_by: string
          created_at: string
          is_active: boolean
          season: number
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          created_by: string
          created_at?: string
          is_active?: boolean
          season?: number
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          created_by?: string
          created_at?: string
          is_active?: boolean
          season?: number
        }
      }
      admin_pools: {
        Row: {
          admin_id: string
          pool_id: string
          joined_at: string
          is_owner: boolean
        }
        Insert: {
          admin_id: string
          pool_id: string
          joined_at?: string
          is_owner?: boolean
        }
        Update: {
          admin_id?: string
          pool_id?: string
          joined_at?: string
          is_owner?: boolean
        }
      }
      participants: {
        Row: {
          id: string
          pool_id: string
          name: string
          email: string | null
          created_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          pool_id: string
          name: string
          email?: string | null
          created_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          pool_id?: string
          name?: string
          email?: string | null
          created_at?: string
          is_active?: boolean
        }
      }
      games: {
        Row: {
          id: string
          week: number
          season: number
          home_team: string
          away_team: string
          kickoff_time: string
          winner: string | null
          home_score: number | null
          away_score: number | null
          game_status: string
          created_at: string
        }
        Insert: {
          id?: string
          week: number
          season: number
          home_team: string
          away_team: string
          kickoff_time: string
          winner?: string | null
          home_score?: number | null
          away_score?: number | null
          game_status?: string
          created_at?: string
        }
        Update: {
          id?: string
          week?: number
          season?: number
          home_team?: string
          away_team?: string
          kickoff_time?: string
          winner?: string | null
          home_score?: number | null
          away_score?: number | null
          game_status?: string
          created_at?: string
        }
      }
      picks: {
        Row: {
          id: string
          participant_id: string
          pool_id: string
          game_id: string
          predicted_winner: string
          confidence_points: number
          locked: boolean
          submitted_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          pool_id: string
          game_id: string
          predicted_winner: string
          confidence_points: number
          locked?: boolean
          submitted_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          pool_id?: string
          game_id?: string
          predicted_winner?: string
          confidence_points?: number
          locked?: boolean
          submitted_by?: string | null
          created_at?: string
        }
      }
      scores: {
        Row: {
          id: string
          participant_id: string
          pool_id: string
          week: number
          season: number
          points: number
          correct_picks: number
          total_picks: number
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          pool_id: string
          week: number
          season: number
          points: number
          correct_picks: number
          total_picks: number
          created_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          pool_id?: string
          week?: number
          season?: number
          points?: number
          correct_picks?: number
          total_picks?: number
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          action: string
          admin_id: string
          entity: string
          entity_id: string
          details: any
          created_at: string
        }
        Insert: {
          id?: string
          action: string
          admin_id: string
          entity: string
          entity_id: string
          details?: any
          created_at?: string
        }
        Update: {
          id?: string
          action?: string
          admin_id?: string
          entity?: string
          entity_id?: string
          details?: any
          created_at?: string
        }
      }
    }
  }
} 