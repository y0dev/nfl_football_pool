import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { poolId, name, email } = await request.json();

    if (!poolId || !name || !email) {
      return NextResponse.json(
        { error: 'Pool ID, name, and email are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // First, check if the pool exists and is active
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('id, name, is_active')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404 }
      );
    }

    if (!pool.is_active) {
      return NextResponse.json(
        { error: 'This pool is currently inactive and not accepting new participants' },
        { status: 400 }
      );
    }

    // Check if participant already exists
    const { data: existingParticipant, error: checkError } = await supabase
      .from('participants')
      .select('id')
      .eq('pool_id', poolId)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing participant:', checkError);
      return NextResponse.json(
        { error: 'Failed to check participant status' },
        { status: 500 }
      );
    }

    if (existingParticipant) {
      return NextResponse.json(
        { 
          message: 'Already joined',
          participant: existingParticipant,
          poolName: pool.name
        },
        { status: 200 }
      );
    }

    // Create new participant
    const { data: newParticipant, error: insertError } = await supabase
      .from('participants')
      .insert({
        pool_id: poolId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating participant:', insertError);
      return NextResponse.json(
        { error: 'Failed to join pool' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Successfully joined pool',
      participant: newParticipant,
      poolName: pool.name
    });

  } catch (error) {
    console.error('Error in join pool API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
