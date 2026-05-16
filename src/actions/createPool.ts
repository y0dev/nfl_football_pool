'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { DEFAULT_POOL_SEASON } from '@/lib/utils';

export async function createPool(poolData: {
  name: string;
  created_by: string;
  season?: number;
  pool_type?: 'normal' | 'knockout';
  join_password?: string;
  season_scope?: number[];
  is_private?: boolean;
}) {
  try {
    const supabase = getSupabaseServiceClient();
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

    if (error) throw error;

    // Send email notification to pool creator (dynamically imported to avoid client bundle)
    try {
      // Get admin info
      const { data: admin } = await supabase
        .from('admins')
        .select('full_name, email')
        .eq('email', poolData.created_by)
        .eq('is_active', true)
        .maybeSingle();

      if (admin && admin.email) {
        const { emailService } = await import('@/lib/email');
        await emailService.sendPoolCreationNotification(
          admin.email,
          admin.full_name || poolData.created_by,
          poolData.name,
          data.id
        );
      }
    } catch (emailError) {
      console.error('Error sending pool creation email:', emailError);
      // Don't fail pool creation if email fails
    }

    return data;
  } catch (error) {
    console.error('Error creating pool:', error);
    throw error;
  }
}
