import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugLog } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    debugLog('Transfer pool started');
    const { poolId, newCommissionerEmail } = await request.json();
    debugLog('Transfer pool data received:', { poolId, newCommissionerEmail });

    // Validate input
    if (!poolId || !newCommissionerEmail) {
      debugLog('Validation failed: missing fields');
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    debugLog('Supabase service client created');

    // Verify the new commissioner exists and is active
    debugLog('Verifying new commissioner...');
    const { data: newCommissioner, error: commissionerError } = await supabase
      .from('admins')
      .select('id, email, is_active, is_super_admin')
      .eq('email', newCommissionerEmail)
      .eq('is_active', true)
      .single();

    if (commissionerError || !newCommissioner) {
      debugLog('New commissioner not found or inactive:', commissionerError);
      return NextResponse.json(
        { success: false, error: 'New commissioner not found or account is inactive' },
        { status: 404 }
      );
    }

    if (newCommissioner.is_super_admin) {
      debugLog('Cannot transfer pool to super admin');
      return NextResponse.json(
        { success: false, error: 'Cannot transfer pool to super admin account' },
        { status: 400 }
      );
    }

    // Get current pool information
    debugLog('Getting current pool information...');
    const { data: currentPool, error: poolError } = await supabase
      .from('pools')
      .select('id, name, created_by, is_active')
      .eq('id', poolId)
      .single();

    if (poolError || !currentPool) {
      debugLog('Pool not found:', poolError);
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    debugLog('Transferring pool:', currentPool.name, 'from', currentPool.created_by, 'to', newCommissionerEmail);

    // Transfer the pool ownership
    debugLog('Updating pool ownership...');
    const { error: updateError } = await supabase
      .from('pools')
      .update({ created_by: newCommissionerEmail })
      .eq('id', poolId);

    if (updateError) {
      debugLog('Error updating pool ownership:', updateError);
      return NextResponse.json(
        { success: false, error: `Failed to transfer pool: ${updateError.message}` },
        { status: 500 }
      );
    }

    debugLog('Pool ownership updated successfully');

    // Log the transfer
    try {
      debugLog('Logging to audit_logs...');
      await supabase
        .from('audit_logs')
        .insert({
          action: 'transfer_pool',
          admin_id: newCommissioner.id,
          entity: 'pool',
          entity_id: poolId,
          details: { 
            pool_id: poolId,
            pool_name: currentPool.name,
            previous_owner: currentPool.created_by,
            new_owner: newCommissionerEmail
          }
        });
      debugLog('Audit log created successfully');
    } catch (auditError) {
      console.warn('Failed to log pool transfer to audit_logs:', auditError);
      // Don't fail the transfer if audit logging fails
    }

    debugLog('Pool transfer completed successfully, returning success response');
    return NextResponse.json({
      success: true,
      message: `Pool "${currentPool.name}" has been transferred to ${newCommissionerEmail}`,
      pool: {
        id: poolId,
        name: currentPool.name,
        previousOwner: currentPool.created_by,
        newOwner: newCommissionerEmail
      }
    });

  } catch (error) {
    console.error('Transfer pool error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
