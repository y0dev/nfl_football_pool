import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function DELETE(request: NextRequest) {
  try {
    const { adminId } = await request.json();

    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Admin ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // First, check if the admin exists and get their details
    const { data: admin, error: fetchError } = await supabase
      .from('admins')
      .select('id, email, is_super_admin')
      .eq('id', adminId)
      .single();

    if (fetchError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of super admins (optional safety measure)
    if (admin.is_super_admin) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete super admin accounts' },
        { status: 403 }
      );
    }

    // Delete the admin from the admins table
    const { error: deleteError } = await supabase
      .from('admins')
      .delete()
      .eq('id', adminId);

    if (deleteError) {
      console.error('Error deleting admin:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete admin account' },
        { status: 500 }
      );
    }

    // Optionally, also delete the user from Supabase Auth
    try {
      // Get the auth user ID by email
      const { data: authUser, error: authFetchError } = await supabase.auth.admin.listUsers();
      if (!authFetchError && authUser.users) {
        const userToDelete = authUser.users.find(user => user.email === admin.email);
        if (userToDelete) {
          await supabase.auth.admin.deleteUser(userToDelete.id);
        }
      }
    } catch (authDeleteError) {
      console.warn('Failed to delete auth user, but admin record was deleted:', authDeleteError);
      // Don't fail the entire operation if auth deletion fails
    }

    // Log the deletion action
    try {
      await supabase
        .from('audit_logs')
        .insert({
          action: 'delete_admin',
          admin_id: null, // No admin performing this action (system action)
          entity: 'admin',
          entity_id: adminId,
          details: { 
            deleted_admin_email: admin.email,
            deleted_admin_id: adminId 
          }
        });
    } catch (auditError) {
      console.warn('Failed to log admin deletion to audit_logs:', auditError);
      // Don't fail the operation if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Admin account deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting admin:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
