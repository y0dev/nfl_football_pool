import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { poolId, newPassword } = await request.json();

    // Validate input
    if (!poolId || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Access code must be at least 4 characters' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Check if pool exists
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('id, name')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Update pool access code (for now, we'll store it in a simple way)
    // In a real implementation, you might want to hash this or store it differently
    const { error: updateError } = await supabase
      .from('pools')
      .update({ 
        access_code: newPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', poolId);

    if (updateError) {
      console.error('Error updating pool access code:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to reset access code' },
        { status: 500 }
      );
    }

    // Log the access code reset
    await supabase
      .from('audit_logs')
      .insert({
        action: 'reset_pool_access_code',
        admin_id: null, // No specific admin performing this action
        entity: 'pool',
        entity_id: poolId,
        details: { 
          pool_id: poolId,
          pool_name: pool.name,
          action: 'access_code_reset'
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Access code reset successfully'
    });

  } catch (error) {
    console.error('Error resetting pool access code:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
