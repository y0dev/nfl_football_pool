import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const season = parseInt(searchParams.get('season') || String(new Date().getFullYear()));

    if (!poolId) {
      return NextResponse.json({ success: false, error: 'poolId is required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    const [participantsResult, teamsResult, submissionsResult] = await Promise.all([
      supabase.from('participants').select('id, name').eq('pool_id', poolId).eq('is_active', true).order('name'),
      supabase.from('playoff_teams').select('id').eq('season', season),
      supabase.from('playoff_confidence_points').select('participant_id').eq('pool_id', poolId).eq('season', season),
    ]);

    const allParticipants = participantsResult.data || [];
    const teamsCount = teamsResult.data?.length || 0;

    const counts = new Map<string, number>();
    submissionsResult.data?.forEach(s => counts.set(s.participant_id, (counts.get(s.participant_id) || 0) + 1));

    const participants = allParticipants
      .map(p => ({
        id: p.id,
        name: p.name,
        submissionCount: counts.get(p.id) || 0,
        totalTeams: teamsCount,
        hasSubmitted: (counts.get(p.id) || 0) === teamsCount && teamsCount > 0,
      }))
      .sort((a, b) => a.hasSubmitted !== b.hasSubmitted ? (a.hasSubmitted ? -1 : 1) : a.name.localeCompare(b.name));

    return NextResponse.json({ success: true, participants });
  } catch (error) {
    debugError('[SH][API][DB] Playoff participants status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load playoff participant status' }, { status: 500 });
  }
}
