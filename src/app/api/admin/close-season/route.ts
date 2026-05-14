import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

interface ParticipantScore {
  participant_id: string;
  participant_name: string;
  total_points: number;
  total_correct_picks: number;
  weeks_won: number;
}

async function computeSeasonWinner(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  poolId: string,
  season: number
) {
  // Compute directly from picks + game outcomes (authoritative even when scores table is empty)
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, winner')
    .eq('season', season)
    .not('winner', 'is', null);

  if (gamesError || !games || games.length === 0) return null;

  const gameWinners = new Map(games.map(g => [g.id, g.winner as string]));

  const { data: picks, error: picksError } = await supabase
    .from('picks')
    .select('participant_id, game_id, predicted_winner, confidence_points')
    .eq('pool_id', poolId)
    .in('game_id', [...gameWinners.keys()]);

  if (picksError || !picks || picks.length === 0) return null;

  // Fetch participant names separately
  const participantIds = [...new Set(picks.map(p => p.participant_id))];
  const { data: participants } = await supabase
    .from('participants')
    .select('id, name')
    .in('id', participantIds);
  const nameMap = new Map((participants ?? []).map(p => [p.id, p.name as string]));

  const totalsMap = new Map<string, ParticipantScore>();
  for (const pick of picks) {
    const actualWinner = gameWinners.get(pick.game_id);
    const isCorrect = actualWinner &&
      pick.predicted_winner?.toLowerCase() === actualWinner.toLowerCase();
    const points = isCorrect ? (pick.confidence_points ?? 0) : 0;
    const name = nameMap.get(pick.participant_id) ?? 'Unknown';

    const existing = totalsMap.get(pick.participant_id);
    if (existing) {
      existing.total_points += points;
      if (isCorrect) existing.total_correct_picks += 1;
    } else {
      totalsMap.set(pick.participant_id, {
        participant_id: pick.participant_id,
        participant_name: name,
        total_points: points,
        total_correct_picks: isCorrect ? 1 : 0,
        weeks_won: 0,
      });
    }
  }

  const { data: weeklyWinners } = await supabase
    .from('weekly_winners')
    .select('winner_participant_id')
    .eq('pool_id', poolId)
    .eq('season', season);

  for (const w of weeklyWinners ?? []) {
    const p = totalsMap.get(w.winner_participant_id);
    if (p) p.weeks_won += 1;
  }

  const sorted: ParticipantScore[] = Array.from(totalsMap.values())
    .sort((a, b) => b.total_points - a.total_points || b.total_correct_picks - a.total_correct_picks);

  if (sorted.length === 0) return null;

  const maxPoints = sorted[0].total_points;
  const topScorers = sorted.filter(p => p.total_points === maxPoints);
  const winner = topScorers[0];

  return {
    pool_id: poolId,
    season,
    winner_participant_id: winner.participant_id,
    winner_name: winner.participant_name,
    total_points: winner.total_points,
    total_correct_picks: winner.total_correct_picks,
    weeks_won: winner.weeks_won,
    tie_breaker_used: topScorers.length > 1,
    total_participants: sorted.length,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season, poolId } = body as { season?: number; poolId?: string };

    if (!season && !poolId) {
      return NextResponse.json(
        { success: false, error: 'Provide season or poolId' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Fetch target pools
    let query = supabase
      .from('pools')
      .select('id, name, season, is_active, pool_type');

    if (poolId) {
      query = query.eq('id', poolId);
    } else {
      query = query.eq('season', season!);
    }

    const { data: pools, error: poolsError } = await query;

    if (poolsError) throw poolsError;
    if (!pools || pools.length === 0) {
      return NextResponse.json({ success: true, closed: [], winnersComputed: [], message: 'No pools found' });
    }

    const closed: string[] = [];
    const alreadyClosed: string[] = [];
    const winnersComputed: string[] = [];
    const winnersAlreadyExist: string[] = [];
    const errors: string[] = [];

    for (const pool of pools) {
      // 1. Deactivate
      if (pool.is_active) {
        const { error } = await supabase
          .from('pools')
          .update({ is_active: false })
          .eq('id', pool.id);

        if (error) {
          errors.push(`${pool.name}: failed to deactivate — ${error.message}`);
        } else {
          closed.push(pool.name);
        }
      } else {
        alreadyClosed.push(pool.name);
      }

      // 2. Season winner
      const { data: existingWinner } = await supabase
        .from('season_winners')
        .select('id')
        .eq('pool_id', pool.id)
        .eq('season', pool.season)
        .single();

      if (existingWinner) {
        winnersAlreadyExist.push(pool.name);
      } else {
        const winner = await computeSeasonWinner(supabase, pool.id, pool.season);
        if (!winner) {
          errors.push(`${pool.name}: no score data to compute winner`);
        } else {
          const { error: upsertError } = await supabase
            .from('season_winners')
            .upsert(winner, { onConflict: 'pool_id,season' });

          if (upsertError) {
            errors.push(`${pool.name}: failed to save winner — ${upsertError.message}`);
          } else {
            winnersComputed.push(`${pool.name} → ${winner.winner_name} (${winner.total_points} pts)`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      closed,
      alreadyClosed,
      winnersComputed,
      winnersAlreadyExist,
      errors,
      totalProcessed: pools.length,
    });
  } catch (error) {
    console.error('[SH][STATE][SEASON] close-season error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
