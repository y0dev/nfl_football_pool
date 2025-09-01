import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { adminId, isActive } = await request.json();

    // Validate input
    if (!adminId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Check if admin exists
    const { data: admin, error: checkError } = await supabase
      .from('admins')
      .select('id, email, full_name, is_super_admin')
      .eq('id', adminId)
      .single();

    if (checkError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      );
    }

    // Prevent deactivating admins (optional security measure)
    if (admin.is_super_admin && !isActive) {
      return NextResponse.json(
        { success: false, error: 'Cannot deactivate admin accounts' },
        { status: 400 }
      );
    }

    // Update admin status
    const { error: updateError } = await supabase
      .from('admins')
      .update({ is_active: isActive })
      .eq('id', adminId);

    if (updateError) {
      console.error('Error updating admin status:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update admin status' },
        { status: 500 }
      );
    }

    // Log the status change
    await supabase
      .from('audit_logs')
      .insert({
        action: 'toggle_admin_status',
        admin_id: adminId,
        entity: 'admin',
        entity_id: adminId,
        details: `${admin.email} ${isActive ? 'activated' : 'deactivated'}`
      });

    return NextResponse.json({
      success: true,
      message: `Admin ${isActive ? 'activated' : 'deactivated'} successfully`,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        is_active: isActive
      }
    });

  } catch (error) {
    console.error('Toggle admin status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
