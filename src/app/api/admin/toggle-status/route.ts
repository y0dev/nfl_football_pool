import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireSuperAdmin } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const supabase = getSupabaseServiceClient();

    // Parse request body
    const { adminId, isActive } = await request.json();
    
    if (adminId === undefined || isActive === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Target is always a commissioner — super-admin status isn't managed
    // through this route.
    const { data: targetAdmin, error: targetAdminError } = await supabase
      .from('commissioners')
      .select('*')
      .eq('id', adminId)
      .single();

    if (targetAdminError || !targetAdmin) {
      return NextResponse.json({ success: false, error: 'Admin not found' }, { status: 404 });
    }

    // Update the active status
    const { error: updateError } = await supabase
      .from('commissioners')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', adminId);

    if (updateError) {
      debugError('Error updating status:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update status' }, { status: 500 });
    }

    // Send notification email (best-effort)
    try {
      const { emailService } = await import('@/lib/email');
      await emailService.sendStatusChangeNotification(
        targetAdmin.email,
        targetAdmin.full_name || 'Commissioner',
        isActive,
      );
    } catch (e) {
      debugError('Status notification email failed:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Commissioner ${isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    debugError('Status toggle error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
