'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { DEFAULT_POOL_SEASON, debugError } from '@/lib/utils';
import { getAdminPlanByEmail, LIMITS, Plan } from '@/lib/plan';

export type CreatePoolResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string; limitReached?: true; plan?: Plan; limit?: number };

export async function createPool(poolData: {
  name: string;
  created_by: string;
  season?: number;
  pool_type?: 'normal' | 'knockout';
  join_password?: string;
  season_scope?: number[];
  is_private?: boolean;
}): Promise<CreatePoolResult> {
  try {
    const supabase = getSupabaseServiceClient();

    const planInfo = await getAdminPlanByEmail(poolData.created_by);
    const poolLimit = LIMITS[planInfo.plan].pools;
    const { count: poolCount } = await supabase
      .from('pools')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', poolData.created_by);

    if ((poolCount ?? 0) >= poolLimit) {
      return {
        success: false,
        error: `Your ${planInfo.plan} plan allows ${poolLimit} pool${poolLimit === 1 ? '' : 's'}.`,
        limitReached: true,
        plan: planInfo.plan,
        limit: poolLimit,
      };
    }

    const { data, error } = await supabase
      .from('pools')
      .insert({
        name: poolData.name,
        created_by: poolData.created_by,
        season: poolData.season || DEFAULT_POOL_SEASON,
        pool_type: poolData.pool_type || 'normal',
        is_active: true,
        is_private: poolData.is_private ?? false,
        season_scope: poolData.season_scope ?? [2],
        ...(poolData.join_password ? { join_password: poolData.join_password } : {}),
      })
      .select()
      .single();

    if (error) {
      debugError('[SH][API][POOL] Insert failed:', error);
      return { success: false, error: 'Failed to create pool. Please try again.' };
    }

    // Non-critical: send welcome email
    try {
      const { data: admin } = await supabase
        .from('admins')
        .select('full_name, email')
        .eq('email', poolData.created_by)
        .eq('is_active', true)
        .maybeSingle();

      if (admin?.email) {
        const { emailService } = await import('@/lib/email');
        await emailService.sendPoolCreationNotification(
          admin.email,
          admin.full_name || poolData.created_by,
          poolData.name,
          data.id
        );
      }
    } catch (emailError) {
      debugError('Error sending pool creation email:', emailError);
    }

    return { success: true, data };
  } catch (error) {
    debugError('[SH][API][POOL] Unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
