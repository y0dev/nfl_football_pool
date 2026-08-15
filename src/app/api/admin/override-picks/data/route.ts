import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { findAccountByEmail } from '@/lib/accounts';
import { debugError } from '@/lib/utils';

// Server-only replacement for override-picks-panel.tsx's direct
// client-side reads (games for the week, existing picks with joins,
// pool participants) — the write path (POST /api/admin/override-picks)
// already went through a proper server route; only these reads didn't.
export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const week = parseInt(searchParams.get('week') ?? '', 10);
    const season = parseInt(searchParams.get('season') ?? '', 10);
    const seasonType = parseInt(searchParams.get('seasonType') ?? '', 10);
    if (!poolId || isNaN(week) || isNaN(season) || isNaN(seasonType)) {
      return NextResponse.json({ success: false, error: 'poolId, week, season, and seasonType are required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: pool } = await supabase.from('pools').select('created_by').eq('id', poolId).maybeSingle();
    if (!pool) {
      return NextResponse.json({ success: false, error: 'Pool not found' }, { status: 404 });
    }

    const account = await findAccountByEmail(adminEmail, { activeOnly: true });
    const isSuperAdmin = account?.role === 'super_admin';
    if (!isSuperAdmin && pool.created_by !== adminEmail) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { data: gamesData } = await supabase
      .from('games').select('id, home_team, away_team, week, season, season_type, kickoff_time, status')
      .eq('week', week).eq('season', season).eq('season_type', seasonType)
      .order('kickoff_time', { ascending: true });

    const gameIds = (gamesData ?? []).map(g => g.id);

    let picks: unknown[] = [];
    if (gameIds.length > 0) {
      const { data: picksData } = await supabase
        .from('picks')
        .select(`
          id, participant_id, pool_id, game_id, predicted_winner,
          confidence_points, locked, submitted_by, created_at,
          participants(name, email),
          games(home_team, away_team, week, season, season_type)
        `)
        .eq('pool_id', poolId)
        .in('game_id', gameIds)
        .order('created_at', { ascending: false });

      picks = (picksData ?? []).map(p => ({
        ...p,
        participants: Array.isArray(p.participants) ? p.participants[0] : p.participants,
        games: Array.isArray(p.games) ? p.games[0] : p.games,
      }));
    }

    return NextResponse.json({
      success: true,
      games: gamesData ?? [],
      picks,
    });
  } catch (error) {
    debugError('Override picks data error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load override picks data' }, { status: 500 });
  }
}
