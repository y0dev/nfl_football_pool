import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function DELETE(request: NextRequest) {
  try {
    // Verify the request is from a super admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseServiceClient();
    
    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // Verify user is a super admin
    const { data: currentAdmin, error: currentAdminError } = await supabase
      .from('admins')
      .select('is_super_admin')
      .eq('email', user.email)
      .single();
    
    if (currentAdminError || !currentAdmin || !currentAdmin.is_super_admin) {
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
      console.error('Error checking pools:', poolsError);
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
      console.error('Error deleting commissioner:', deleteError);
      return NextResponse.json({ success: false, error: 'Failed to delete commissioner' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Commissioner deleted successfully' 
    });

  } catch (error) {
    console.error('Delete commissioner error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
