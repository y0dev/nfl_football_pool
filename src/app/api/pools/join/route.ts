import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { emailService } from '@/lib/email';
import { debugError } from '@/lib/utils';
import { validateEmail } from '@/lib/email-validation';
import { verifyPoolPasswordAttempt, poolAccessCookieName, POOL_ACCESS_COOKIE_MAX_AGE_SECONDS } from '@/lib/pool-access';

function applyPoolAccessCookie(response: NextResponse, poolId: string, token: string | null) {
  if (!token) return;
  response.cookies.set(poolAccessCookieName(poolId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: POOL_ACCESS_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { poolId, name, email, password } = await request.json();

    if (!poolId || !name || !email) {
      return NextResponse.json(
        { error: 'Pool ID, name, and email are required' },
        { status: 400 }
      );
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.error },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Check if the pool exists and is active
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('id, name, is_active, is_private, join_password, huddles(name)')
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

    // Private pools: the mandatory pool-access password gates joining too
    // (one password, not two) — success also grants viewing access so the
    // new participant isn't immediately prompted again for picks/leaderboard.
    // Public pools: unchanged legacy plaintext join_password gate.
    let poolAccessToken: string | null = null;
    if (pool.is_private) {
      const result = await verifyPoolPasswordAttempt(poolId, password ?? '');
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      poolAccessToken = result.token;
    } else if (pool.join_password) {
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
      const response = NextResponse.json(
        {
          message: 'Already joined',
          participant: existingParticipant,
          poolName: pool.name
        },
        { status: 200 }
      );
      applyPoolAccessCookie(response, poolId, poolAccessToken);
      return response;
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
        const huddleName = (pool.huddles as unknown as { name: string } | null)?.name;

        await emailService.sendPoolInvitation(
          newParticipant.email,
          newParticipant.name,
          pool.name,
          poolLink,
          huddleName
        );
      }
    } catch (emailError) {
      debugError('Error sending welcome email:', emailError);
      // Don't fail join if email fails
    }

    const response = NextResponse.json({
      message: 'Successfully joined pool',
      participant: newParticipant,
      poolName: pool.name
    });
    applyPoolAccessCookie(response, poolId, poolAccessToken);
    return response;

  } catch (error) {
    debugError('Error in join pool API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
