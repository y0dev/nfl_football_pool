import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { debugError } from '@/lib/utils';

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

    // This route only ever targets commissioners.
    const { data: admin, error: checkError } = await supabase
      .from('commissioners')
      .select('id, email, full_name')
      .eq('id', adminId)
      .single();

    if (checkError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      );
    }

    // Update commissioner status
    const { error: updateError } = await supabase
      .from('commissioners')
      .update({ is_active: isActive })
      .eq('id', adminId);

    if (updateError) {
      debugError('Error updating admin status:', updateError);
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
    debugError('Toggle admin status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
