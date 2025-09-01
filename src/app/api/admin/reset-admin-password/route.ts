import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugLog } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    debugLog('Reset admin password started');
    const { adminId, newPassword } = await request.json();
    debugLog('Reset password data received:', { adminId });

    // Validate input
    if (!adminId || !newPassword) {
      debugLog('Validation failed: missing fields');
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      debugLog('Validation failed: password too short');
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    debugLog('Supabase service client created');

    // Update the user's password in Supabase Auth
    debugLog('Updating password in Supabase Auth...');
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      adminId,
      { password: newPassword }
    );

    if (updateError) {
      debugLog('Error updating password:', updateError);
      return NextResponse.json(
        { success: false, error: `Failed to update password: ${updateError.message}` },
        { status: 500 }
      );
    }

    debugLog('Password updated successfully');

    // Log the password reset
    try {
      debugLog('Logging to audit_logs...');
      await supabase
        .from('audit_logs')
        .insert({
          action: 'reset_admin_password',
          admin_id: adminId,
          entity: 'admin',
          entity_id: adminId,
          details: { admin_id: adminId }
        });
      debugLog('Audit log created successfully');
    } catch (auditError) {
      console.warn('Failed to log password reset to audit_logs:', auditError);
      // Don't fail the password reset if audit logging fails
    }

    debugLog('Password reset completed successfully, returning success response');
    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset admin password error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
