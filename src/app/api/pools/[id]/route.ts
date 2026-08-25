import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { DUMMY_POOL, isDummyData, debugLog, debugError} from '@/lib/utils';
import { checkPoolAccessFromRequest } from '@/lib/pool-access';
import { updatePool } from '@/actions/updatePool';

// GET - Get public pool details with stats (no authentication for public
// pools; private pools require a valid pool-access cookie — see
// src/lib/pool-access.ts. Defense-in-depth behind the proxy.ts page gate.)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isDummyData()) {
    return NextResponse.json({
      success: true,
      pool: DUMMY_POOL
    });
  }

  try {
    const { id: poolId } = await params;
    debugLog(`Received request for pool ID: ${poolId}`);

    const access = await checkPoolAccessFromRequest(poolId, request);
    if (!access.allowed) {
      if (access.reason === 'not_found') {
        return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: 'Pool access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const seasonType = searchParams.get('seasonType');
    
    const supabase = getSupabaseServiceClient();

    // Get pool details
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('id, name, season, season_scope, is_active, is_private, created_by, created_at, tie_breaker_method, tie_breaker_question, tie_breaker_answer, competition_type')
      .eq('id', poolId)
      .single();

    if (poolError) {
      debugError('Error fetching pool:', poolError);
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Get participant count
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id')
      .eq('pool_id', poolId)
      .eq('is_active', true);

    if (participantsError) {
      debugError('Error fetching participants:', participantsError);
    }

    // Get picks status if week and season type are provided
    let picksData = null;
    let submittedCount = 0;
    
    if (week && seasonType) {
      try {
        const { data: picks, error: picksError } = await supabase
          .from('picks')
          .select('participant_id, games!inner(week, season_type)')
          .eq('pool_id', poolId)
          .eq('games.week', parseInt(week))
          .eq('games.season_type', parseInt(seasonType));

        if (!picksError && picks) {
          const submittedIds = new Set(picks.map(p => p.participant_id));
          submittedCount = submittedIds.size;
          picksData = {
            hasPicks: picks.length > 0,
            submittedCount: submittedCount
          };
        }
      } catch (error) {
        debugError('Error fetching picks:', error);
      }
    }
    
    // Only return public pool information (exclude sensitive fields)
    const publicPool = {
      id: pool.id,
      name: pool.name,
      season: pool.season,
      season_scope: pool.season_scope,
      is_active: pool.is_active,
      is_private: pool.is_private,
      created_at: pool.created_at,
      tie_breaker_method: pool.tie_breaker_method,
      tie_breaker_question: pool.tie_breaker_question,
      tie_breaker_answer: pool.tie_breaker_answer,
      competition_type: pool.competition_type,
      participant_count: participants?.length || 0,
      is_test_mode: !participants || participants.length === 0,
      picks_status: picksData
    };

    return NextResponse.json({
      success: true,
      pool: publicPool
    });

  } catch (error) {
    debugError('Error in pool GET API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Real REST wrapper around the updatePool() Server Action.
// updatePool is normally called directly from the browser (pool-settings.tsx
// invokes it as a Server Action RPC, which always runs within a real request
// scope), so this route isn't needed for the app itself — it exists so
// updatePool's own ownership check (requireActionCallerOwnsPool, which reads
// the sh-session cookie via next/headers) can be exercised over real HTTP in
// tests, the same way clone-pool's REST route lets that Server Action be
// tested without a browser.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poolId } = await params;
    const updates = await request.json();
    const pool = await updatePool(poolId, updates);
    return NextResponse.json({ success: true, pool });
  } catch (error) {
    debugError('Error in pool PATCH API:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Not signed in.' ? 401 : message === 'Insufficient permissions.' ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
