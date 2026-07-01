import { getSupabaseServiceClient } from './supabase';

export type Plan = 'free' | 'standard' | 'pro';

export const LIMITS: Record<Plan, { pools: number; participants: number }> = {
  free:     { pools: 1,        participants: 15       },
  standard: { pools: 1,        participants: 30       },
  pro:      { pools: 3,        participants: 75      },
};

export interface PlanInfo {
  plan: Plan;
  isTrialActive: boolean;
  daysLeft: number;
  trialEndsAt: string | null;
}

function computePlanInfo(rawPlan: string | null, trialEndsAt: string | null): PlanInfo {
  const now = new Date();
  const trialDate = trialEndsAt ? new Date(trialEndsAt) : null;
  const isTrialActive = trialDate ? trialDate > now : false;
  const daysLeft = isTrialActive && trialDate
    ? Math.ceil((trialDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // While trial is active, grant Standard-level access regardless of plan column
  const plan: Plan = isTrialActive ? 'standard' : ((rawPlan as Plan) ?? 'free');
  return { plan, isTrialActive, daysLeft, trialEndsAt };
}

export async function getAdminPlan(adminId: string): Promise<PlanInfo> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from('admins')
    .select('plan, trial_ends_at')
    .eq('id', adminId)
    .single();

  return computePlanInfo(data?.plan ?? 'free', data?.trial_ends_at ?? null);
}

export async function getAdminPlanByEmail(email: string): Promise<PlanInfo> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from('admins')
    .select('plan, trial_ends_at')
    .eq('email', email)
    .single();

  return computePlanInfo(data?.plan ?? 'free', data?.trial_ends_at ?? null);
}

export function trialEndDate(daysFromNow = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}
