import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireSuperAdmin } from '@/lib/accounts';
import { debugLog, debugError, debugWarn} from '@/lib/utils';

export async function DELETE(request: NextRequest) {
  try {
    debugLog('Delete admin started');

    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const supabase = getSupabaseServiceClient();

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


    // Despite the route name, this only ever deletes commissioners — kept
    // for backward compatibility with existing callers; new code should
    // prefer delete-commissioner.
    debugLog('Getting commissioner data...');
    const { data: adminData, error: fetchError } = await supabase
      .from('commissioners')
      .select('email')
      .eq('id', adminId)
      .maybeSingle();

    if (fetchError) {
      debugLog('Error fetching commissioner data:', fetchError);
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

    debugLog('Deleting admin:', adminData.email);

    // Delete commissioner record
    debugLog('Deleting admin record...');
    const { error: deleteError } = await supabase
      .from('commissioners')
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
      debugWarn('Failed to delete auth user, but admin record was deleted:', authDeleteError);
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
      debugWarn('Failed to log admin deletion to audit_logs:', auditError);
      // Don't fail the deletion if audit logging fails
    }

    debugLog('Admin deletion completed successfully, returning success response');
    return NextResponse.json({
      success: true,
      message: 'Admin deleted successfully'
    });

  } catch (error) {
    debugError('Delete admin error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
