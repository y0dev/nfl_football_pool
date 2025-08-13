import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

// GET - Get pool details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poolId } = await params;
    const supabase = getSupabaseClient();

    const { data: pool, error } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (error) {
      console.error('Error fetching pool:', error);
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      pool
    });

  } catch (error) {
    console.error('Error in pool GET API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update pool details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poolId } = await params;
    const body = await request.json();
    const supabase = getSupabaseClient();

    // Validate required fields
    if (!body.name || !body.season) {
      return NextResponse.json(
        { success: false, error: 'Name and season are required' },
        { status: 400 }
      );
    }

    // Update pool
    const { data: updatedPool, error } = await supabase
      .from('pools')
      .update({
        name: body.name,
        description: body.description || null,
        season: body.season,
        is_active: body.is_active,
        tie_breaker_method: body.tie_breaker_method || null,
        tie_breaker_question: body.tie_breaker_question || null,
        tie_breaker_answer: body.tie_breaker_answer || null,
      })
      .eq('id', poolId)
      .select()
      .single();

    if (error) {
      console.error('Error updating pool:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update pool' },
        { status: 500 }
      );
    }

    // Log the action
    await supabase
      .from('audit_logs')
      .insert({
        action: 'update_pool',
        admin_id: 'system', // This should be the actual admin ID
        entity: 'pools',
        entity_id: poolId,
        details: { 
          pool_name: body.name,
          updated_fields: Object.keys(body)
        }
      });

    return NextResponse.json({
      success: true,
      pool: updatedPool
    });

  } catch (error) {
    console.error('Error in pool PUT API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete pool
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poolId } = await params;
    const supabase = getSupabaseClient();

    // First, get the pool details for logging
    const { data: pool } = await supabase
      .from('pools')
      .select('name')
      .eq('id', poolId)
      .single();

    // Check if pool has active participants
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id')
      .eq('pool_id', poolId)
      .eq('is_active', true);

    if (participantsError) {
      console.error('Error checking participants:', participantsError);
    }

    if (participants && participants.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete pool with active participants. Please remove all participants first.' },
        { status: 400 }
      );
    }

    // Delete the pool
    const { error } = await supabase
      .from('pools')
      .delete()
      .eq('id', poolId);

    if (error) {
      console.error('Error deleting pool:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete pool' },
        { status: 500 }
      );
    }

    // Log the action
    await supabase
      .from('audit_logs')
      .insert({
        action: 'delete_pool',
        admin_id: 'system', // This should be the actual admin ID
        entity: 'pools',
        entity_id: poolId,
        details: { 
          pool_name: pool?.name || 'Unknown',
          action: 'deleted'
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Pool deleted successfully'
    });

  } catch (error) {
    console.error('Error in pool DELETE API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
