import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { emailService } from '@/lib/email';
import { debugError } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { poolId, name, email, password } = await request.json();

    if (!poolId || !name || !email) {
      return NextResponse.json(
        { error: 'Pool ID, name, and email are required' },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'production' && email.split('@')[1]?.toLowerCase() === 'test') {
      return NextResponse.json(
        { error: 'Test email addresses are not allowed.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Check if the pool exists and is active
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('id, name, is_active, join_password')
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

    // Verify join password if the pool requires one
    if (pool.join_password) {
      if (!password || password !== pool.join_password) {
        return NextResponse.json(
          { error: 'Incorrect pool password. Please check with your commissioner.' },
          { status: 403 }
        );
      }
    }

    // Check if participant already exists
    const { data: existingParticipant, error: checkError } = await supabase
      .from('participants')
      .select('id')
      .eq('pool_id', poolId)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (checkError) {
      debugError('Error checking existing participant:', checkError);
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

    // Enforce the pool's participant limit (plan-based, or the flat preseason
    // test-pool cap) before adding anyone new
    const { checkParticipantCapacity } = await import('@/lib/plan');
    const capacity = await checkParticipantCapacity(poolId);
    if (!capacity.allowed) {
      return NextResponse.json(
        { error: capacity.message ?? 'This pool is full and not accepting new participants.' },
        { status: 403 }
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
      debugError('Error creating participant:', insertError);
      return NextResponse.json(
        { error: 'Failed to join pool' },
        { status: 500 }
      );
    }

    // Send welcome email to participant
    try {
      if (newParticipant.email) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const poolLink = `${baseUrl}/pool/${poolId}/picks`;
        
        await emailService.sendPoolInvitation(
          newParticipant.email,
          newParticipant.name,
          pool.name,
          poolLink
        );
      }
    } catch (emailError) {
      debugError('Error sending welcome email:', emailError);
      // Don't fail join if email fails
    }

    return NextResponse.json({
      message: 'Successfully joined pool',
      participant: newParticipant,
      poolName: pool.name
    });

  } catch (error) {
    debugError('Error in join pool API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
