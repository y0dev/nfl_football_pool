import { createClient, SupabaseClient } from '@supabase/supabase-js'


// Pin singleton to globalThis so Next.js module re-evaluation (HMR, Strict Mode)
// doesn't create additional GoTrueClient instances in the same browser/process context.
const g = globalThis as typeof globalThis & {
  __supabaseClient?: SupabaseClient;
};

export function getSupabaseClient() {
  if (g.__supabaseClient) return g.__supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Supabase URL is required. Please set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in your environment variables.');
  }

  if (!supabaseAnonKey) {
    throw new Error('Supabase anon key is required. Please set SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables.');
  }

  g.__supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: 'pkce', detectSessionInUrl: false },
  });
  return g.__supabaseClient;
}

// getSupabaseServiceClient() moved to './supabase-service' (server-only) —
// keeping it out of this file stops its inlined secret from being bundled
// into client JS alongside getSupabaseClient(), which client components do
// legitimately import from here.

function getDefaultSupabaseClient() {
  if (typeof window !== 'undefined') return getSupabaseClient();
  return null;
}

type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          id: string
          email: string
          password_hash: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string | null
          is_super_admin: boolean
          is_active: boolean
          plan: string | null
          trial_ends_at: string | null
          // Billing migration columns (see docs/stripe-billing-setup.md) —
          // optional until the migration runs; code reads them defensively
          billing_exempt?: boolean | null
          addon_pools?: number | null
          stripe_customer_id?: string | null
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string | null
          is_super_admin?: boolean
          is_active?: boolean
          plan?: string | null
          trial_ends_at?: string | null
          billing_exempt?: boolean | null
          addon_pools?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string | null
          is_super_admin?: boolean
          is_active?: boolean
          plan?: string | null
          trial_ends_at?: string | null
          billing_exempt?: boolean | null
          addon_pools?: number | null
          stripe_customer_id?: string | null
        }
      }
      // Commissioners (regular users who run Huddles/pools and pay via
      // Stripe) — split out from admins, which is now super-admins only.
      // Same id-space convention as admins: id mirrors the Supabase Auth
      // user id where applicable, so RLS's `id = auth.uid()` self-row
      // policy works identically. See scripts/migrate-commissioners.ts.
      commissioners: {
        Row: {
          id: string
          email: string
          password_hash: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string | null
          is_active: boolean
          plan: string | null
          trial_ends_at: string | null
          billing_exempt?: boolean | null
          addon_pools?: number | null
          stripe_customer_id?: string | null
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string | null
          is_active?: boolean
          plan?: string | null
          trial_ends_at?: string | null
          billing_exempt?: boolean | null
          addon_pools?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string | null
          is_active?: boolean
          plan?: string | null
          trial_ends_at?: string | null
          billing_exempt?: boolean | null
          addon_pools?: number | null
          stripe_customer_id?: string | null
        }
      }
      // Payment audit trail — one row per completed Stripe checkout.
      // admin_id keeps its name (matches every existing call site) but
      // references commissioners(id) now, not admins(id) — billing is
      // commissioner-only.
      payments: {
        Row: {
          id: string
          admin_id: string | null
          stripe_session_id: string
          stripe_payment_intent: string | null
          product: string
          quantity: number
          amount_cents: number | null
          currency: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          admin_id?: string | null
          stripe_session_id: string
          stripe_payment_intent?: string | null
          product: string
          quantity?: number
          amount_cents?: number | null
          currency?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          admin_id?: string | null
          stripe_session_id?: string
          stripe_payment_intent?: string | null
          product?: string
          quantity?: number
          amount_cents?: number | null
          currency?: string | null
          status?: string
          created_at?: string
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
          pool_type: string
          is_private: boolean
          join_password: string | null
          private_password_encrypted: string | null
          private_password_version: number
          tie_breaker_method: string
          tie_breaker_question: string | null
          tie_breaker_answer: number | null
          require_access_code: boolean
          season_scope: number[]
          huddle_id: string | null
          competition_type: string
          type_settings: Record<string, unknown>
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          created_by: string
          created_at?: string
          is_active?: boolean
          season?: number
          pool_type?: string
          is_private?: boolean
          join_password?: string | null
          private_password_encrypted?: string | null
          private_password_version?: number
          tie_breaker_method?: string
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          require_access_code?: boolean
          season_scope?: number[]
          huddle_id?: string | null
          competition_type?: string
          type_settings?: Record<string, unknown>
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          created_by?: string
          created_at?: string
          is_active?: boolean
          season?: number
          pool_type?: string
          is_private?: boolean
          join_password?: string | null
          private_password_encrypted?: string | null
          private_password_version?: number
          tie_breaker_method?: string
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          require_access_code?: boolean
          season_scope?: number[]
          huddle_id?: string | null
          competition_type?: string
          type_settings?: Record<string, unknown>
        }
      }
      huddles: {
        Row: {
          id: string
          name: string
          commissioner_email: string
          settings: Record<string, unknown>
          is_active: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          commissioner_email: string
          settings?: Record<string, unknown>
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          commissioner_email?: string
          settings?: Record<string, unknown>
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
      }
      // Not yet wired into app logic — schema only. See docs/database-schema-updates.md.
      huddle_co_commissioners: {
        Row: {
          huddle_id: string
          admin_email: string
          invited_at: string
          accepted_at: string | null
        }
        Insert: {
          huddle_id: string
          admin_email: string
          invited_at?: string
          accepted_at?: string | null
        }
        Update: {
          huddle_id?: string
          admin_email?: string
          invited_at?: string
          accepted_at?: string | null
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
          huddle_member_id: string | null
        }
        Insert: {
          id?: string
          pool_id: string
          name: string
          email?: string | null
          created_at?: string
          is_active?: boolean
          huddle_member_id?: string | null
        }
        Update: {
          id?: string
          pool_id?: string
          name?: string
          email?: string | null
          created_at?: string
          is_active?: boolean
          huddle_member_id?: string | null
        }
      }
      huddle_members: {
        Row: {
          id: string
          huddle_id: string
          name: string
          email: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          huddle_id: string
          name: string
          email?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          huddle_id?: string
          name?: string
          email?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      huddle_transfer_requests: {
        Row: {
          id: string
          huddle_id: string
          from_email: string
          to_email: string
          status: string
          from_token: string
          to_token: string
          from_confirmed_at: string | null
          to_confirmed_at: string | null
          completed_at: string | null
          failure_reason: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          huddle_id: string
          from_email: string
          to_email: string
          status?: string
          from_token?: string
          to_token?: string
          from_confirmed_at?: string | null
          to_confirmed_at?: string | null
          completed_at?: string | null
          failure_reason?: string | null
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          huddle_id?: string
          from_email?: string
          to_email?: string
          status?: string
          from_token?: string
          to_token?: string
          from_confirmed_at?: string | null
          to_confirmed_at?: string | null
          completed_at?: string | null
          failure_reason?: string | null
          expires_at?: string
          created_at?: string
        }
      }
      pool_transfer_requests: {
        Row: {
          id: string
          pool_id: string
          from_email: string
          to_email: string
          status: string
          from_token: string
          to_token: string
          from_confirmed_at: string | null
          to_confirmed_at: string | null
          completed_at: string | null
          failure_reason: string | null
          remove_from_source_roster: boolean
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          pool_id: string
          from_email: string
          to_email: string
          status?: string
          from_token?: string
          to_token?: string
          from_confirmed_at?: string | null
          to_confirmed_at?: string | null
          completed_at?: string | null
          failure_reason?: string | null
          remove_from_source_roster?: boolean
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          pool_id?: string
          from_email?: string
          to_email?: string
          status?: string
          from_token?: string
          to_token?: string
          from_confirmed_at?: string | null
          to_confirmed_at?: string | null
          completed_at?: string | null
          failure_reason?: string | null
          remove_from_source_roster?: boolean
          expires_at?: string
          created_at?: string
        }
      }
      season_settings: {
        Row: {
          id: string
          season: number
          preseason_start_date: string | null
          regular_season_start_date: string | null
          postseason_start_date: string | null
          current_week: number
          current_season_type: number
          season_over: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          season: number
          preseason_start_date?: string | null
          regular_season_start_date?: string | null
          postseason_start_date?: string | null
          current_week?: number
          current_season_type?: number
          season_over?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          season?: number
          preseason_start_date?: string | null
          regular_season_start_date?: string | null
          postseason_start_date?: string | null
          current_week?: number
          current_season_type?: number
          season_over?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      games: {
        Row: {
          id: string
          week: number
          season: number
          season_type: number
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
          season_type?: number
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
          season_type?: number
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
          season_type: number
          points: number
          correct_picks: number
          total_picks: number
          rank: number | null
          is_winner: boolean
          tie_breaker_used: boolean
          tie_breaker_rank: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          pool_id: string
          week: number
          season: number
          season_type?: number
          points: number
          correct_picks: number
          total_picks: number
          rank?: number | null
          is_winner?: boolean
          tie_breaker_used?: boolean
          tie_breaker_rank?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          pool_id?: string
          week?: number
          season?: number
          season_type?: number
          points?: number
          correct_picks?: number
          total_picks?: number
          rank?: number | null
          is_winner?: boolean
          tie_breaker_used?: boolean
          tie_breaker_rank?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      tie_breakers: {
        Row: {
          id: string
          participant_id: string
          pool_id: string
          week: number
          season: number
          season_type: number
          answer: number
          game_id: string | null
          submitted_at: string
          is_winner: boolean
          rank: number | null
          tie_breaker_used: boolean
          tie_breaker_rank: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          pool_id: string
          week: number
          season: number
          season_type?: number
          answer: number
          game_id?: string | null
          submitted_at?: string
          is_winner?: boolean
          rank?: number | null
          tie_breaker_used?: boolean
          tie_breaker_rank?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          pool_id?: string
          week?: number
          season?: number
          season_type?: number
          answer?: number
          game_id?: string | null
          submitted_at?: string
          is_winner?: boolean
          rank?: number | null
          tie_breaker_used?: boolean
          tie_breaker_rank?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      weekly_winners: {
        Row: {
          id: string
          pool_id: string
          week: number
          season: number
          season_type: number
          winner_participant_id: string | null
          winner_name: string
          winner_points: number
          winner_correct_picks: number
          tie_breaker_used: boolean
          tie_breaker_question: string | null
          tie_breaker_answer: number | null
          winner_tie_breaker_answer: number | null
          tie_breaker_difference: number | null
          total_participants: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pool_id: string
          week: number
          season: number
          season_type?: number
          winner_participant_id?: string | null
          winner_name: string
          winner_points: number
          winner_correct_picks: number
          tie_breaker_used?: boolean
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          winner_tie_breaker_answer?: number | null
          tie_breaker_difference?: number | null
          total_participants: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pool_id?: string
          week?: number
          season?: number
          season_type?: number
          winner_participant_id?: string | null
          winner_name?: string
          winner_points?: number
          winner_correct_picks?: number
          tie_breaker_used?: boolean
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          winner_tie_breaker_answer?: number | null
          tie_breaker_difference?: number | null
          total_participants?: number
          created_at?: string
          updated_at?: string
        }
      }
      season_winners: {
        Row: {
          id: string
          pool_id: string
          season: number
          winner_participant_id: string | null
          winner_name: string
          total_points: number
          total_correct_picks: number
          weeks_won: number
          tie_breaker_used: boolean
          tie_breaker_question: string | null
          tie_breaker_answer: number | null
          winner_tie_breaker_answer: number | null
          tie_breaker_difference: number | null
          total_participants: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pool_id: string
          season: number
          winner_participant_id?: string | null
          winner_name: string
          total_points: number
          total_correct_picks: number
          weeks_won?: number
          tie_breaker_used?: boolean
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          winner_tie_breaker_answer?: number | null
          tie_breaker_difference?: number | null
          total_participants: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pool_id?: string
          season?: number
          winner_participant_id?: string | null
          winner_name?: string
          total_points?: number
          total_correct_picks?: number
          weeks_won?: number
          tie_breaker_used?: boolean
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          winner_tie_breaker_answer?: number | null
          tie_breaker_difference?: number | null
          total_participants?: number
          created_at?: string
          updated_at?: string
        }
      }
      period_winners: {
        Row: {
          id: string
          pool_id: string
          season: number
          period_name: string
          start_week: number
          end_week: number
          winner_participant_id: string | null
          winner_name: string
          period_points: number
          period_correct_picks: number
          weeks_won: number
          tie_breaker_used: boolean
          tie_breaker_question: string | null
          tie_breaker_answer: number | null
          winner_tie_breaker_answer: number | null
          tie_breaker_difference: number | null
          total_participants: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pool_id: string
          season: number
          period_name: string
          start_week: number
          end_week: number
          winner_participant_id?: string | null
          winner_name: string
          period_points: number
          period_correct_picks: number
          weeks_won?: number
          tie_breaker_used?: boolean
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          winner_tie_breaker_answer?: number | null
          tie_breaker_difference?: number | null
          total_participants: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pool_id?: string
          season?: number
          period_name?: string
          start_week?: number
          end_week?: number
          winner_participant_id?: string | null
          winner_name?: string
          period_points?: number
          period_correct_picks?: number
          weeks_won?: number
          tie_breaker_used?: boolean
          tie_breaker_question?: string | null
          tie_breaker_answer?: number | null
          winner_tie_breaker_answer?: number | null
          tie_breaker_difference?: number | null
          total_participants?: number
          created_at?: string
          updated_at?: string
        }
      }
      playoff_teams: {
        Row: {
          id: string
          season: number
          team_name: string
          team_abbreviation: string | null
          conference: string | null
          seed: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          season: number
          team_name: string
          team_abbreviation?: string | null
          conference?: string | null
          seed?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          season?: number
          team_name?: string
          team_abbreviation?: string | null
          conference?: string | null
          seed?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      playoff_confidence_points: {
        Row: {
          id: string
          participant_id: string
          pool_id: string
          season: number
          team_name: string
          confidence_points: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          pool_id: string
          season: number
          team_name: string
          confidence_points: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          pool_id?: string
          season?: number
          team_name?: string
          confidence_points?: number
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          action: string
          admin_id: string
          entity: string
          entity_id: string
          details: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          action: string
          admin_id: string
          entity: string
          entity_id: string
          details?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          action?: string
          admin_id?: string
          entity?: string
          entity_id?: string
          details?: Record<string, unknown>
          created_at?: string
        }
      }
      payout_configs: {
        Row: {
          id: string
          pool_id: string
          enabled: boolean
          entry_fee: number | null
          tie_policy: 'split' | 'tie_breaker' | 'commissioner'
          weekly_enabled: boolean
          weekly_amount_type: 'fixed' | 'percentage'
          weekly_amount: number | null
          weekly_positions: { place: number; percentage: number }[]
          overall_enabled: boolean
          overall_positions: { place: number; percentage: number }[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pool_id: string
          enabled?: boolean
          entry_fee?: number | null
          tie_policy?: 'split' | 'tie_breaker' | 'commissioner'
          weekly_enabled?: boolean
          weekly_amount_type?: 'fixed' | 'percentage'
          weekly_amount?: number | null
          weekly_positions?: { place: number; percentage: number }[]
          overall_enabled?: boolean
          overall_positions?: { place: number; percentage: number }[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pool_id?: string
          enabled?: boolean
          entry_fee?: number | null
          tie_policy?: 'split' | 'tie_breaker' | 'commissioner'
          weekly_enabled?: boolean
          weekly_amount_type?: 'fixed' | 'percentage'
          weekly_amount?: number | null
          weekly_positions?: { place: number; percentage: number }[]
          overall_enabled?: boolean
          overall_positions?: { place: number; percentage: number }[]
          created_at?: string
          updated_at?: string
        }
      }
      payout_records: {
        Row: {
          id: string
          pool_id: string
          scope: 'weekly' | 'overall'
          season: number
          week: number | null
          season_type: number | null
          place: number
          participant_id: string | null
          participant_name: string
          amount: number
          paid: boolean
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pool_id: string
          scope: 'weekly' | 'overall'
          season: number
          week?: number | null
          season_type?: number | null
          place: number
          participant_id?: string | null
          participant_name: string
          amount: number
          paid?: boolean
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pool_id?: string
          scope?: 'weekly' | 'overall'
          season?: number
          week?: number | null
          season_type?: number | null
          place?: number
          participant_id?: string | null
          participant_name?: string
          amount?: number
          paid?: boolean
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// SQL Table Definitions
// fallow-ignore-next-line unused-export
export const adminsTable = `
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  is_super_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  plan VARCHAR(20) DEFAULT 'free',
  trial_ends_at TIMESTAMP WITH TIME ZONE
);
-- Migrations for existing databases:
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free';
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;
-- Google auth (see supabase/migrations/20260813120000_add_google_linked_to_admins.sql
-- and docs/database-schema-updates.md for why admins needs the same
-- google_linked column commissioners already has):
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS google_linked BOOLEAN NOT NULL DEFAULT false;
-- Billing migration (full version in docs/stripe-billing-setup.md):
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS billing_exempt BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS addon_pools INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
--
-- plan/trial_ends_at/billing_exempt/addon_pools/stripe_customer_id are
-- vestigial here since the commissioners split (scripts/migrate-commissioners.ts)
-- — admins is super-admins only now, and none of those concepts apply to
-- them. Left in place rather than dropped; see that script's summary output
-- for the planned follow-up column cleanup.
`;

// Commissioners — split out of admins so regular users (who run
// Huddles/pools and pay via Stripe) have their own table/id-space, separate
// from super-admins. Same shape as admins minus is_super_admin. See
// scripts/migrate-commissioners.ts for the one-time cutover from admins.
export const commissionersTable = `
CREATE TABLE IF NOT EXISTS commissioners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  plan VARCHAR(20) DEFAULT 'free',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  billing_exempt BOOLEAN NOT NULL DEFAULT false,
  addon_pools INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id VARCHAR(255),
  -- Decoupled from password_hash's 'google_oauth' sentinel on purpose: an
  -- account can have BOTH a real password AND Google linked (see
  -- src/app/account/settings connect/disconnect flows), which a single
  -- column can't represent. google_linked is the one source of truth the
  -- OAuth callback checks before allowing a Google sign-in.
  google_linked BOOLEAN NOT NULL DEFAULT false,
  notification_preferences JSONB NOT NULL DEFAULT '{"pick_reminders":true,"weekly_summaries":true,"season_announcements":true,"product_updates":true}'::jsonb
);
`;

// Payment audit trail — one row per completed Stripe checkout. admin_id
// keeps its name (matches every call site written against it) but
// references commissioners(id), not admins(id) — billing is
// commissioner-only. Previously only documented in
// docs/stripe-billing-setup.md; created for real by the commissioners
// migration since nothing had run that doc's SQL yet.
export const paymentsTable = `
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES commissioners(id) ON DELETE SET NULL,
  stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_payment_intent VARCHAR(255),
  product VARCHAR(30) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_cents INTEGER,
  currency VARCHAR(10) DEFAULT 'usd',
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

// fallow-ignore-next-line unused-export
export const poolsTable = `
CREATE TABLE IF NOT EXISTS pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  season INTEGER NOT NULL,
  pool_type VARCHAR(20) DEFAULT 'normal',
  is_private BOOLEAN NOT NULL DEFAULT false,
  join_password TEXT,
  private_password_encrypted TEXT,
  private_password_version INTEGER NOT NULL DEFAULT 0,
  tie_breaker_method VARCHAR(50),
  tie_breaker_question VARCHAR(255),
  tie_breaker_answer INTEGER,
  require_access_code BOOLEAN DEFAULT true,
  season_scope INTEGER[] DEFAULT '{2}',
  huddle_id UUID REFERENCES huddles(id) ON DELETE SET NULL,
  competition_type VARCHAR(20) NOT NULL DEFAULT 'NFL_CONFIDENCE',
  type_settings JSONB NOT NULL DEFAULT '{}'::jsonb
);
-- Migrations: see docs/migrations/add-pool-join-password.sql,
-- docs/migrations/add-huddles.sql (huddle_id / competition_type /
-- type_settings / is_private / season_scope), and
-- supabase/migrations/20260815120000_add_pool_private_password.sql
-- (private_password_encrypted / private_password_version — mandatory
-- password gate on VIEWING a private pool, see src/lib/pool-access.ts;
-- distinct from join_password, which only ever gated self-registration).
`;

// fallow-ignore-next-line unused-export
export const huddlesTable = `
CREATE TABLE IF NOT EXISTS huddles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  commissioner_email VARCHAR(255) NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- See docs/migrations/add-huddles.sql
`;

// Not yet wired into app logic — schema only. See docs/database-schema-updates.md.
// fallow-ignore-next-line unused-export
export const huddleCoCommissionersTable = `
CREATE TABLE IF NOT EXISTS huddle_co_commissioners (
  huddle_id UUID REFERENCES huddles(id) ON DELETE CASCADE,
  admin_email VARCHAR(255) NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (huddle_id, admin_email)
);
-- See docs/migrations/add-huddles.sql
`;

// fallow-ignore-next-line unused-export
export const huddleMembersTable = `
CREATE TABLE IF NOT EXISTS huddle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES huddles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (huddle_id, email)
);
-- Also adds participants.huddle_member_id — see docs/migrations/add-huddle-members.sql
`;

// fallow-ignore-next-line unused-export
export const huddleTransferRequestsTable = `
CREATE TABLE IF NOT EXISTS huddle_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES huddles(id) ON DELETE CASCADE,
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | completed | cancelled | failed
  from_token UUID NOT NULL DEFAULT gen_random_uuid(),
  to_token UUID NOT NULL DEFAULT gen_random_uuid(),
  from_confirmed_at TIMESTAMP WITH TIME ZONE,
  to_confirmed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_huddle_transfer_requests_huddle_id ON huddle_transfer_requests (huddle_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_huddle_transfer_requests_from_token ON huddle_transfer_requests (from_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_huddle_transfer_requests_to_token ON huddle_transfer_requests (to_token);
-- See docs/migrations/add-huddle-transfer-requests.sql
`;

// fallow-ignore-next-line unused-export
export const poolTransferRequestsTable = `
CREATE TABLE IF NOT EXISTS pool_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | completed | cancelled | failed
  from_token UUID NOT NULL DEFAULT gen_random_uuid(),
  to_token UUID NOT NULL DEFAULT gen_random_uuid(),
  from_confirmed_at TIMESTAMP WITH TIME ZONE,
  to_confirmed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  -- Sender's choice, captured at request time, applied once the transfer
  -- actually executes (both sides confirmed) — see confirmPoolTransfer.
  remove_from_source_roster BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pool_transfer_requests_pool_id ON pool_transfer_requests (pool_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_transfer_requests_from_token ON pool_transfer_requests (from_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_transfer_requests_to_token ON pool_transfer_requests (to_token);
-- See docs/migrations/add-pool-transfer-requests.sql
`;

// fallow-ignore-next-line unused-export
export const adminPoolsTable = `
CREATE TABLE IF NOT EXISTS admin_pools (
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_owner BOOLEAN DEFAULT false,
  PRIMARY KEY (admin_id, pool_id)
);
`;

// fallow-ignore-next-line unused-export
export const participantsTable = `
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  huddle_member_id UUID REFERENCES huddle_members(id) ON DELETE SET NULL
);
-- Migration: see docs/migrations/add-huddle-members.sql
`;

// fallow-ignore-next-line unused-export
export const seasonSettingsTable = `
CREATE TABLE IF NOT EXISTS season_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season INTEGER NOT NULL UNIQUE,
  preseason_start_date DATE,
  regular_season_start_date DATE,
  postseason_start_date DATE,
  current_week INTEGER NOT NULL DEFAULT 1,
  -- 0=offseason, 1=preseason, 2=regular season, 3=postseason — same
  -- convention as games.season_type. current_week is relative to this
  -- phase (e.g. current_week=4 with current_season_type=1 means
  -- preseason week 4, not the 4th week of the whole season).
  current_season_type INTEGER NOT NULL DEFAULT 0,
  season_over BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- See docs/migrations/add-season-settings.sql
`;

// fallow-ignore-next-line unused-export
export const picksTable = `
CREATE TABLE IF NOT EXISTS picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  game_id VARCHAR(255) REFERENCES games(id) ON DELETE CASCADE,
  predicted_winner VARCHAR(255) NOT NULL,
  confidence_points INTEGER NOT NULL,
  locked BOOLEAN DEFAULT false,
  submitted_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, pool_id, game_id)
);
`;

// fallow-ignore-next-line unused-export
export const scoresTable = `
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  season_type INTEGER NOT NULL DEFAULT 2,
  points INTEGER DEFAULT 0,
  correct_picks INTEGER DEFAULT 0,
  total_picks INTEGER DEFAULT 0,
  rank INTEGER NULL,
  is_winner BOOLEAN DEFAULT false,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_rank INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, pool_id, week, season, season_type)
);
`;

// fallow-ignore-next-line unused-export
export const tieBreakersTable = `
CREATE TABLE IF NOT EXISTS tie_breakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  season_type INTEGER NOT NULL DEFAULT 2,
  answer DECIMAL(10,2) NOT NULL,
  game_id TEXT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_winner BOOLEAN DEFAULT false,
  rank INTEGER NULL,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_rank INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, pool_id, week, season, season_type)
);
`;

// fallow-ignore-next-line unused-export
export const weeklyWinnersTable = `
CREATE TABLE IF NOT EXISTS weekly_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  season_type INTEGER NOT NULL DEFAULT 2,
  winner_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  winner_name VARCHAR(255) NOT NULL,
  winner_points INTEGER NOT NULL,
  winner_correct_picks INTEGER NOT NULL,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_question VARCHAR(255) NULL,
  tie_breaker_answer DECIMAL(10,2) NULL,
  winner_tie_breaker_answer DECIMAL(10,2) NULL,
  tie_breaker_difference DECIMAL(10,2) NULL,
  total_participants INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, week, season, season_type)
);
`;

// fallow-ignore-next-line unused-export
export const seasonWinnersTable = `
CREATE TABLE IF NOT EXISTS season_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  winner_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  winner_name VARCHAR(255) NOT NULL,
  total_points INTEGER NOT NULL,
  total_correct_picks INTEGER NOT NULL,
  weeks_won INTEGER NOT NULL DEFAULT 0,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_question VARCHAR(255) NULL,
  tie_breaker_answer DECIMAL(10,2) NULL,
  winner_tie_breaker_answer DECIMAL(10,2) NULL,
  tie_breaker_difference DECIMAL(10,2) NULL,
  total_participants INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, season)
);
`;

// fallow-ignore-next-line unused-export
export const periodWinnersTable = `
CREATE TABLE IF NOT EXISTS period_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  period_name VARCHAR(50) NOT NULL,
  start_week INTEGER NOT NULL,
  end_week INTEGER NOT NULL,
  winner_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  winner_name VARCHAR(255) NOT NULL,
  period_points INTEGER NOT NULL,
  period_correct_picks INTEGER NOT NULL,
  weeks_won INTEGER NOT NULL DEFAULT 0,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_question VARCHAR(255) NULL,
  tie_breaker_answer DECIMAL(10,2) NULL,
  winner_tie_breaker_answer DECIMAL(10,2) NULL,
  tie_breaker_difference DECIMAL(10,2) NULL,
  total_participants INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, season, period_name)
);
`;

const playoffTeamsTable = `
CREATE TABLE IF NOT EXISTS playoff_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season INTEGER NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  team_abbreviation VARCHAR(10),
  conference VARCHAR(50),
  seed INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(season, team_name)
);
`;

const playoffConfidencePointsTable = `
CREATE TABLE IF NOT EXISTS playoff_confidence_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  confidence_points INTEGER NOT NULL CHECK (confidence_points > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, pool_id, season, team_name),
  UNIQUE(participant_id, pool_id, season, confidence_points)
);
`;

// fallow-ignore-next-line unused-export
export const auditLogsTable = `
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(255) NOT NULL,
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  entity VARCHAR(255) NOT NULL,
  entity_id VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

// Manual NFL Data Sync preview/approval workflow (see
// supabase/migrations/20260814150000_add_nfl_sync_preview_tables.sql and
// src/app/api/admin/nfl-sync/{preview,apply}/route.ts). A sync run fetches
// from ESPN, diffs against `games`, and persists the proposal here instead
// of writing games directly — approval later re-checks base_snapshot
// against the live games row before applying (staleness guard). The
// automated background score sync (supabase/functions/update-game-scores)
// is separate and untouched — it writes directly, but only ever touches
// status/score on games that already exist.
// fallow-ignore-next-line unused-export
export const nflSyncRunsTable = `
CREATE TABLE IF NOT EXISTS nfl_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by VARCHAR(255) NOT NULL,
  season INTEGER NOT NULL,
  season_type INTEGER NOT NULL,
  week INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
  games_checked INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  unchanged_count INTEGER NOT NULL DEFAULT 0,
  applied_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  stale_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(255)
);
`;

// fallow-ignore-next-line unused-export
export const nflSyncProposedChangesTable = `
CREATE TABLE IF NOT EXISTS nfl_sync_proposed_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id UUID NOT NULL REFERENCES nfl_sync_runs(id) ON DELETE CASCADE,
  external_game_id VARCHAR(255) NOT NULL,
  change_type VARCHAR(20) NOT NULL,
  field_diffs JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_payload JSONB NOT NULL,
  base_snapshot JSONB,
  decision VARCHAR(20) NOT NULL DEFAULT 'pending',
  decided_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nfl_sync_proposed_changes_run ON nfl_sync_proposed_changes(sync_run_id);
CREATE INDEX IF NOT EXISTS idx_nfl_sync_runs_created_at ON nfl_sync_runs(created_at DESC);
`;

// fallow-ignore-next-line unused-export
export const reminderLogsTable = `
CREATE TABLE IF NOT EXISTS reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  season_type INTEGER NOT NULL,
  sent_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  email_sent BOOLEAN DEFAULT true,
  email_content JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

// Payout configuration — see supabase/migrations/20260815180000_add_payout_configuration.sql
// for the full rationale. Sunday Huddle never collects/holds/transfers
// money; this only stores how the commissioner wants winnings calculated.
// fallow-ignore-next-line unused-export
export const payoutConfigsTable = `
CREATE TABLE IF NOT EXISTS payout_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL UNIQUE REFERENCES pools(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  entry_fee NUMERIC(10,2),
  tie_policy TEXT NOT NULL DEFAULT 'split' CHECK (tie_policy IN ('split', 'tie_breaker', 'commissioner')),
  weekly_enabled BOOLEAN NOT NULL DEFAULT false,
  weekly_amount_type TEXT NOT NULL DEFAULT 'fixed' CHECK (weekly_amount_type IN ('fixed', 'percentage')),
  weekly_amount NUMERIC(10,2),
  weekly_positions JSONB NOT NULL DEFAULT '[{"place":1,"percentage":100}]'::jsonb,
  overall_enabled BOOLEAN NOT NULL DEFAULT false,
  overall_positions JSONB NOT NULL DEFAULT '[{"place":1,"percentage":50},{"place":2,"percentage":30},{"place":3,"percentage":20}]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

// Commissioner "Mark Paid" record — record-only, never moves money.
// fallow-ignore-next-line unused-export
export const payoutRecordsTable = `
CREATE TABLE IF NOT EXISTS payout_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('weekly', 'overall')),
  season INTEGER NOT NULL,
  week INTEGER,
  season_type INTEGER,
  place INTEGER NOT NULL,
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, scope, season, week, place)
);
`;

// Teams table
// fallow-ignore-next-line unused-export
export const teamsTable = `
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  abbreviation VARCHAR(10) NOT NULL,
  conference VARCHAR(50),
  division VARCHAR(50),
  season INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(id, season)
);
`;

// Update games table to include team references and playoff flag
// fallow-ignore-next-line unused-export
export const updatedGamesTable = `
CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(255) PRIMARY KEY,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  season_type INTEGER NOT NULL DEFAULT 2,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  kickoff_time TIMESTAMP WITH TIME ZONE NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  winner VARCHAR(255),
  status VARCHAR(50) DEFAULT 'scheduled',
  home_team_id VARCHAR(255),
  away_team_id VARCHAR(255),
  is_playoff BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

// fallow-ignore-next-line unused-export
export const rlsPolicies = `
-- Enable Row Level Security on all tables
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tie_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE huddles ENABLE ROW LEVEL SECURITY;
ALTER TABLE huddle_co_commissioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE huddle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE huddle_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Huddles table policies — commissioner/admin-only. Participants never
-- query huddles directly, so no participant-facing SELECT policy exists.
CREATE POLICY "Service role can manage huddles" ON huddles
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage huddle co-commissioners" ON huddle_co_commissioners
  FOR ALL USING (auth.role() = 'service_role');

-- League roster — same commissioner/admin-only model as huddles above.
CREATE POLICY "Service role can manage huddle members" ON huddle_members
  FOR ALL USING (auth.role() = 'service_role');

-- Transfer requests carry tokens that must never be readable except via the
-- service client (server actions validate the token themselves) — no
-- client-side policy of any kind.
CREATE POLICY "Service role can manage huddle transfer requests" ON huddle_transfer_requests
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage pool transfer requests" ON pool_transfer_requests
  FOR ALL USING (auth.role() = 'service_role');

-- Season phase boundaries — read via server actions only, same
-- service-role-only model as huddles above.
CREATE POLICY "Service role can manage season settings" ON season_settings
  FOR ALL USING (auth.role() = 'service_role');

-- Admins table policies
CREATE POLICY "Admins can view their own profile" ON admins
  FOR SELECT USING (
    id = auth.uid() 
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage admins" ON admins
  FOR ALL USING (auth.role() = 'service_role');

-- Commissioners table policies — same self-row shape as admins above, since
-- id mirrors the Supabase Auth user id the same way.
CREATE POLICY "Commissioners can view their own profile" ON commissioners
  FOR SELECT USING (
    id = auth.uid()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage commissioners" ON commissioners
  FOR ALL USING (auth.role() = 'service_role');

-- Payments table — service-role only, no client access needed.
CREATE POLICY "Service role can manage payments" ON payments
  FOR ALL USING (auth.role() = 'service_role');

-- Participants table policies
CREATE POLICY "Participants are viewable by all authenticated users" ON participants
  FOR SELECT USING (true);

CREATE POLICY "Users can join pools" ON participants
  FOR INSERT WITH CHECK (
    -- Allow users to join pools (for the join pool functionality)
    true
    OR EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Only admins can update participants" ON participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

-- Picks table policies
CREATE POLICY "Users can only view their own picks" ON picks
  FOR SELECT USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can only insert picks for themselves" ON picks
  FOR INSERT WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can only update their own picks" ON picks
  FOR UPDATE USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Admins can view all picks" ON picks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

-- Scores table policies
CREATE POLICY "Users can only view their own scores" ON scores
  FOR SELECT USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Admins can view all scores" ON scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

-- Tie-breakers table policies
CREATE POLICY "Users can only view their own tie-breakers" ON tie_breakers
  FOR SELECT USING (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can only insert tie-breakers for themselves" ON tie_breakers
  FOR INSERT WITH CHECK (
    participant_id IN (
      SELECT id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Admins can view all tie-breakers" ON tie_breakers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

-- Weekly winners table policies
CREATE POLICY "Users can view weekly winners for pools they participate in" ON weekly_winners
  FOR SELECT USING (
    pool_id IN (
      SELECT pool_id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

-- Season winners table policies
CREATE POLICY "Users can view season winners for pools they participate in" ON season_winners
  FOR SELECT USING (
    pool_id IN (
      SELECT pool_id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );

-- Period winners table policies
CREATE POLICY "Users can view period winners for pools they participate in" ON period_winners
  FOR SELECT USING (
    pool_id IN (
      SELECT pool_id FROM participants 
      WHERE email = auth.jwt() ->> 'email'
    )
    OR EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_active = true
    )
    OR auth.role() = 'service_role'
  );
`; 
