'use server';

import { debugError, debugWarn, isDummyData, DUMMY_PARTICIPANTS, DUMMY_POOL } from '@/lib/utils';

// Get pool participants
export async function getPoolParticipants(poolId: string) {
  if (isDummyData()) {
    return DUMMY_PARTICIPANTS.map(p => ({
      ...p,
      pool_id: DUMMY_POOL.id,
      is_active: true,
      created_at: DUMMY_POOL.created_at,
    }));
  }

  try {
    const { adminService } = await import('@/lib/admin-service');
    return await adminService.getPoolParticipants(poolId);
  } catch (error) {
    debugError('Failed to get pool participants:', error);
    throw error;
  }
}

// Add participant to pool
export async function addParticipantToPool(poolId: string, name: string, email?: string, huddleMemberId?: string) {
  try {
    // Get the service role client to bypass RLS policies
    const { getSupabaseServiceClient } = await import('@/lib/supabase-service');
    const supabase = getSupabaseServiceClient();

    // Email is optional here, but when provided it must be real
    if (email?.trim()) {
      const { validateEmail } = await import('@/lib/email-validation');
      const emailCheck = validateEmail(email);
      if (!emailCheck.valid) {
        throw new Error(emailCheck.error ?? 'Invalid email address.');
      }
    }

    // Plan limit check (preseason test pools cap at 15 on every plan)
    const { checkParticipantCapacity } = await import('@/lib/plan');
    const capacity = await checkParticipantCapacity(poolId);
    if (!capacity.allowed) {
      throw new Error(capacity.message ?? 'This pool is full.');
    }

    // Check if participant already exists in this pool
    const { data: existingParticipant } = await supabase
      .from('participants')
      .select('id')
      .eq('pool_id', poolId)
      .eq('email', email)
      .single();

    if (existingParticipant) {
      throw new Error('Participant already exists in this pool');
    }

    // Add participant to pool
    const { data: participant, error: insertError } = await supabase
      .from('participants')
      .insert({
        pool_id: poolId,
        name: name.trim(),
        email: email?.trim() || null,
        is_active: true,
        huddle_member_id: huddleMemberId ?? null
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    // Log the action
    try {
      const { error: logError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'add_participant',
          admin_id: null, // Service role doesn't have a specific admin ID
          entity: 'participant',
          entity_id: participant.id,
          details: { 
            participant_id: participant.id,
            participant_name: name,
            participant_email: email,
            pool_id: poolId,
            action: 'participant_added'
          }
        });
      
      if (logError) {
        debugWarn('Failed to log participant addition:', logError);
      }
    } catch (logError) {
      debugWarn('Failed to log participant addition:', logError);
      // Don't throw error for logging failure
    }

    // Send welcome email to participant if email is provided (dynamically imported to avoid client bundle)
    if (email && participant.email) {
      try {
        const { emailService } = await import('@/lib/email');
        const { data: poolData } = await supabase
          .from('pools')
          .select('name, huddles(name)')
          .eq('id', poolId)
          .single();

        if (poolData) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const poolLink = `${baseUrl}/pool/${poolId}/picks`;
          const huddleName = (poolData.huddles as unknown as { name: string } | null)?.name;

          await emailService.sendPoolInvitation(
            participant.email,
            participant.name,
            poolData.name,
            poolLink,
            huddleName
          );
        }
      } catch (emailError) {
        debugError('Error sending welcome email:', emailError);
        // Don't fail participant addition if email fails
      }
    }

    return participant;
  } catch (error) {
    debugError('Failed to add participant to pool:', error);
    throw error;
  }
}

// Remove participant from pool
export async function removeParticipantFromPool(participantId: string) {
  try {
    // Get the service role client to bypass RLS policies
    const { getSupabaseServiceClient } = await import('@/lib/supabase-service');
    const supabase = getSupabaseServiceClient();

    // First get the participant to get the pool_id for logging
    const { data: participant, error: fetchError } = await supabase
      .from('participants')
      .select('pool_id, name, email')
      .eq('id', participantId)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    // Remove participant from pool
    const { error: deleteError } = await supabase
      .from('participants')
      .delete()
      .eq('id', participantId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // Log the action
    try {
      const { error: logError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'remove_participant',
          admin_id: null, // Service role doesn't have a specific admin ID
          entity: 'participant',
          entity_id: participantId,
          details: { 
            participant_id: participantId,
            participant_name: participant.name,
            participant_email: participant.email,
            pool_id: participant.pool_id,
            action: 'participant_removed'
          }
        });
      
      if (logError) {
        debugWarn('Failed to log participant removal:', logError);
      }
    } catch (logError) {
      debugWarn('Failed to log participant removal:', logError);
      // Don't throw error for logging failure
    }

    return true;
  } catch (error) {
    debugError('Failed to remove participant from pool:', error);
    throw error;
  }
}

// Update participant name
export async function updateParticipantName(participantId: string, newName: string) {
  try {
    // Get the service role client to bypass RLS policies
    const { getSupabaseServiceClient } = await import('@/lib/supabase-service');
    const supabase = getSupabaseServiceClient();
    
    // First get the participant to get the pool_id for logging
    const { data: participant, error: fetchError } = await supabase
      .from('participants')
      .select('pool_id, name')
      .eq('id', participantId)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    // Actually update the participant name in the database using service role
    const { error: updateError } = await supabase
      .from('participants')
      .update({ name: newName.trim() })
      .eq('id', participantId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Log the action
    try {
      const { error: logError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'update_participant',
          admin_id: null, // Service role doesn't have a specific admin ID
          entity: 'participant',
          entity_id: participantId,
          details: { 
            participant_id: participantId, 
            old_name: participant.name,
            new_name: newName.trim(),
            action: 'name_updated',
            pool_id: participant.pool_id
          }
        });
      
      if (logError) {
        debugWarn('Failed to log participant update:', logError);
      }
    } catch (logError) {
      debugWarn('Failed to log participant update:', logError);
      // Don't throw error for logging failure
    }

    return true;
  } catch (error) {
    debugError('Failed to update participant name:', error);
    throw error;
  }
}

