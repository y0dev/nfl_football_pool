import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireSuperAdmin } from '@/lib/accounts';

// Quick at-a-glance inventory for the sync page — how many games exist per
// season/season_type right now, so an admin can spot a suspiciously low
// count (e.g. a season showing 0 regular-season games) without having to
// run a full scan first.
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseServiceClient();
  const { data: games, error } = await supabase
    .from('games')
    .select('season, season_type');

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const counts = new Map<string, { season: number; seasonType: number; count: number }>();
  for (const g of games ?? []) {
    const key = `${g.season}-${g.season_type}`;
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { season: g.season, seasonType: g.season_type, count: 1 });
  }

  const rows = [...counts.values()].sort((a, b) => (b.season - a.season) || (a.seasonType - b.seasonType));

  return NextResponse.json({ success: true, rows });
}
