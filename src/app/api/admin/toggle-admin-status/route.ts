import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugLog } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    debugLog('Toggle admin status started');
    const { adminId } = await request.json();
    debugLog('Toggle status data received:', { adminId });

    // Validate input
    if (!adminId) {
      debugLog('Validation failed: missing adminId');
      return NextResponse.json(
        { success: false, error: 'Missing admin ID' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    debugLog('Supabase service client created');

    // Get current admin status
    debugLog('Getting current admin status...');
    const { data: adminData, error: fetchError } = await supabase
      .from('admins')
      .select('is_active, is_super_admin')
      .eq('id', adminId)
      .single();

    if (fetchError) {
      debugLog('Error fetching admin data:', fetchError);
      return NextResponse.json(
        { success: false, error: `Failed to fetch admin data: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!adminData) {
      debugLog('Admin not found');
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      );
    }

    // Prevent deactivating super admins
    if (adminData.is_super_admin) {
      debugLog('Cannot toggle status for super admin');
      return NextResponse.json(
        { success: false, error: 'Cannot deactivate super admin accounts' },
        { status: 400 }
      );
    }

    const newStatus = !adminData.is_active;
    debugLog('Toggling status from', adminData.is_active, 'to', newStatus);

    // Update admin status
    debugLog('Updating admin status...');
    const { error: updateError } = await supabase
      .from('admins')
      .update({ is_active: newStatus })
      .eq('id', adminId);

    if (updateError) {
      debugLog('Error updating admin status:', updateError);
      return NextResponse.json(
        { success: false, error: `Failed to update admin status: ${updateError.message}` },
        { status: 500 }
      );
    }

    debugLog('Admin status updated successfully');

    // Log the status change
    try {
      debugLog('Logging to audit_logs...');
      await supabase
        .from('audit_logs')
        .insert({
          action: newStatus ? 'activate_admin' : 'deactivate_admin',
          admin_id: adminId,
          entity: 'admin',
          entity_id: adminId,
          details: { 
            admin_id: adminId,
            previous_status: adminData.is_active,
            new_status: newStatus
          }
        });
      debugLog('Audit log created successfully');
    } catch (auditError) {
      console.warn('Failed to log status change to audit_logs:', auditError);
      // Don't fail the status change if audit logging fails
    }

    debugLog('Status toggle completed successfully, returning success response');
    return NextResponse.json({
      success: true,
      message: `Admin ${newStatus ? 'activated' : 'deactivated'} successfully`,
      newStatus: newStatus
    });

  } catch (error) {
    console.error('Toggle admin status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
