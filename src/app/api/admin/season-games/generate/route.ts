import { NextRequest, NextResponse } from 'next/server';
import { nflAPI } from '@/lib/nfl-api';

export async function POST(request: NextRequest) {
  try {
    const { weekStart, weekEnd, week } = await request.json();

    console.log(`Received request to generate games for week ${week} with date range ${weekStart} to ${weekEnd}`);
    if (!weekStart || !weekEnd) {
      return NextResponse.json({ success: false, error: 'weekStart and weekEnd (YYYYMMDD) are required' }, { status: 400 });
    }

    const games = await nflAPI.getWeekGames(weekStart, weekEnd);
    console.log(`Fetched ${games.length} games for week ${week} (${weekStart} to ${weekEnd})`);

    return NextResponse.json({ success: true, week: Number(week ?? 0), games, gameCount: games.length });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch games from ESPN',
      week: 0,
      games: [],
      gameCount: 0,
    }, { status: 500 });
  }
}
