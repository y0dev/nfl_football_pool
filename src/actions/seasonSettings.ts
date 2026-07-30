'use server';

import { getSupabaseServiceClient } from '@/lib/supabase';
import { getSeasonSettings, upsertSeasonSettings, SeasonSettings } from '@/lib/seasonSettings';
import { getNFLSeasonYear } from '@/lib/utils';

export async function loadSeasonSettings(season: number = getNFLSeasonYear()): Promise<SeasonSettings> {
  return getSeasonSettings(season);
}

async function verifySuperAdmin(callerEmail: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient();
  const { data: caller } = await supabase
    .from('admins')
    .select('is_super_admin')
    .eq('email', callerEmail)
    .eq('is_active', true)
    .maybeSingle();
  return caller?.is_super_admin === true;
}

export type UpdateSeasonSettingsResult =
  | { success: true; settings: SeasonSettings }
  | { success: false; error: string };

/** Super-admin only — season phase boundaries affect what every
 * commissioner can create, not just the caller's own account. */
export async function updateSeasonSettings(
  season: number,
  updates: Partial<Omit<SeasonSettings, 'season'>>,
  callerEmail: string
): Promise<UpdateSeasonSettingsResult> {
  if (!(await verifySuperAdmin(callerEmail))) {
    return { success: false, error: 'Insufficient permissions.' };
  }
  return upsertSeasonSettings(season, updates);
}
