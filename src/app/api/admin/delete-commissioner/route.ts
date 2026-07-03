import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError } from '@/lib/utils';

export async function DELETE(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();

    const { data: currentAdmin } = await supabase
      .from('admins')
      .select('is_super_admin')
      .eq('email', adminEmail)
      .single();

    if (!currentAdmin?.is_super_admin) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse request body
    const { adminId } = await request.json();
    
    if (!adminId) {
      return NextResponse.json({ success: false, error: 'Missing admin ID' }, { status: 400 });
    }

    // Get the admin record to verify it exists and is not a super admin
    const { data: targetAdmin, error: targetAdminError } = await supabase
      .from('admins')
      .select('*')
      .eq('id', adminId)
      .single();

    if (targetAdminError || !targetAdmin) {
      return NextResponse.json({ success: false, error: 'Admin not found' }, { status: 404 });
    }

    if (targetAdmin.is_super_admin) {
      return NextResponse.json({ success: false, error: 'Cannot delete super admins' }, { status: 403 });
    }

    // Check if commissioner has any pools
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name')
      .eq('created_by', targetAdmin.email);

    if (poolsError) {
      debugError('Error checking pools:', poolsError);
      return NextResponse.json({ success: false, error: 'Failed to check commissioner pools' }, { status: 500 });
    }

    if (pools && pools.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Cannot delete commissioner with active pools: ${pools.map(p => p.name).join(', ')}` 
      }, { status: 400 });
    }

    // Delete the commissioner
    const { error: deleteError } = await supabase
      .from('admins')
      .delete()
      .eq('id', adminId);

    if (deleteError) {
      debugError('Error deleting commissioner:', deleteError);
      return NextResponse.json({ success: false, error: 'Failed to delete commissioner' }, { status: 500 });
    }

    // Clean up Supabase Auth user (best-effort)
    try {
      await supabase.auth.admin.deleteUser(adminId);
    } catch { /* non-fatal — older accounts may not have an auth user */ }

    // Send farewell email (best-effort)
    try {
      const { emailService } = await import('@/lib/email');
      await emailService.sendAccountDeletionConfirmation(
        targetAdmin.email,
        targetAdmin.full_name || 'Commissioner',
      );
    } catch (e) {
      debugError('[SH][API][ADMIN] Farewell email failed:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Commissioner deleted successfully'
    });

  } catch (error) {
    debugError('Delete commissioner error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
