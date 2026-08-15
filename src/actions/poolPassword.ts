'use server';

import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { encryptPoolPassword, revealPoolPassword, validatePoolPassword } from '@/lib/pool-access';
import { debugError } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type ActionResult<T extends object = {}> = ({ success: true } & T) | { success: false; error: string };

async function requireOwnedPrivatePool(poolId: string, requestedBy: string) {
  const supabase = getSupabaseServiceClient();
  const { data: pool } = await supabase
    .from('pools')
    .select('id, created_by, is_private, private_password_version')
    .eq('id', poolId)
    .maybeSingle();

  if (!pool) return { ok: false as const, error: 'Pool not found.' };
  if (pool.created_by !== requestedBy) return { ok: false as const, error: 'You do not have permission to manage this pool.' };
  if (!pool.is_private) return { ok: false as const, error: 'Only private pools have a password.' };
  return { ok: true as const, pool };
}

/** Set or change a private pool's password. Bumping
 * private_password_version invalidates every previously-issued pool-access
 * cookie for this pool immediately (see src/lib/pool-access.ts) — no
 * separate cookie-revocation step needed. */
export async function setPoolPassword(
  poolId: string,
  requestedBy: string,
  password: string,
  confirmPassword: string
): Promise<ActionResult> {
  const owned = await requireOwnedPrivatePool(poolId, requestedBy);
  if (!owned.ok) return { success: false, error: owned.error };

  const validationError = validatePoolPassword(password, confirmPassword);
  if (validationError) return { success: false, error: validationError };

  const encrypted = await encryptPoolPassword(password);
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from('pools')
    .update({
      private_password_encrypted: encrypted,
      private_password_version: (owned.pool.private_password_version ?? 0) + 1,
    })
    .eq('id', poolId);

  if (error) {
    debugError('Error setting pool password:', error);
    return { success: false, error: 'Failed to update the pool password. Please try again.' };
  }
  return { success: true };
}

/** Powers the commissioner dashboard's "needs a password" warning (Step 4)
 * — every active private pool this commissioner owns that has never had a
 * password configured. */
export async function getPrivatePoolsNeedingPassword(commissionerEmail: string): Promise<{ id: string; name: string }[]> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from('pools')
    .select('id, name')
    .eq('created_by', commissionerEmail)
    .eq('is_private', true)
    .eq('is_active', true)
    .is('private_password_encrypted', null);
  return data ?? [];
}

/** Commissioner-only reveal, used for the "Show/Copy Password" control and
 * the share-message generator. Never call this without an authenticated
 * requestedBy that's independently verified to be the caller's own email. */
export async function revealPoolPasswordForCommissioner(
  poolId: string,
  requestedBy: string
): Promise<ActionResult<{ password: string }>> {
  const owned = await requireOwnedPrivatePool(poolId, requestedBy);
  if (!owned.ok) return { success: false, error: owned.error };

  const password = await revealPoolPassword(poolId);
  if (!password) {
    return { success: false, error: 'This pool has not been configured with a password yet.' };
  }
  return { success: true, password };
}
