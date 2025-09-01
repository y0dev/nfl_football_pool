import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugLog } from '@/lib/utils';

export async function DELETE(request: NextRequest) {
  try {
    debugLog('Delete admin started');
    const { adminId } = await request.json();
    debugLog('Delete admin data received:', { adminId });

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

    // Get admin data to check if it's a super admin
    debugLog('Getting admin data...');
    const { data: adminData, error: fetchError } = await supabase
      .from('admins')
      .select('is_super_admin, email')
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

    // Prevent deleting super admins
    if (adminData.is_super_admin) {
      debugLog('Cannot delete super admin');
      return NextResponse.json(
        { success: false, error: 'Cannot delete super admin accounts' },
        { status: 400 }
      );
    }

    debugLog('Deleting admin:', adminData.email);

    // Delete admin record from admins table
    debugLog('Deleting admin record...');
    const { error: deleteError } = await supabase
      .from('admins')
      .delete()
      .eq('id', adminId);

    if (deleteError) {
      debugLog('Error deleting admin record:', deleteError);
      return NextResponse.json(
        { success: false, error: `Failed to delete admin record: ${deleteError.message}` },
        { status: 500 }
      );
    }

    // Delete user from Supabase Auth
    debugLog('Deleting user from Supabase Auth...');
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(adminId);

    if (authDeleteError) {
      debugLog('Error deleting auth user:', authDeleteError);
      // Log the error but don't fail the request since the admin record was deleted
      console.warn('Failed to delete auth user, but admin record was deleted:', authDeleteError);
    }

    debugLog('Admin deleted successfully');

    // Log the deletion
    try {
      debugLog('Logging to audit_logs...');
      await supabase
        .from('audit_logs')
        .insert({
          action: 'delete_admin',
          admin_id: adminId,
          entity: 'admin',
          entity_id: adminId,
          details: { 
            admin_id: adminId,
            admin_email: adminData.email
          }
        });
      debugLog('Audit log created successfully');
    } catch (auditError) {
      console.warn('Failed to log admin deletion to audit_logs:', auditError);
      // Don't fail the deletion if audit logging fails
    }

    debugLog('Admin deletion completed successfully, returning success response');
    return NextResponse.json({
      success: true,
      message: 'Admin deleted successfully'
    });

  } catch (error) {
    console.error('Delete admin error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
