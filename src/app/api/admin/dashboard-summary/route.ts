import { NextRequest, NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/accounts';
import { adminService } from '@/lib/admin-service';
import { debugError } from '@/lib/utils';

// Server-only replacement for the commissioner/super-admin dashboards'
// direct client-side AdminService usage (which required shipping the
// Supabase service role key to the browser). Role is resolved from the DB
// here, never trusted from the client, unlike the AdminService calls this
// replaces.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') ?? '', 10);
    const seasonType = parseInt(searchParams.get('seasonType') ?? '', 10);
    if (isNaN(week) || isNaN(seasonType)) {
      return NextResponse.json({ success: false, error: 'week and seasonType are required' }, { status: 400 });
    }

    const [stats, pools] = await Promise.all([
      adminService.getDashboardStats(week, seasonType, auth.email, auth.isSuperAdmin),
      adminService.getActivePools(auth.email, auth.isSuperAdmin),
    ]);

    return NextResponse.json({ success: true, stats, pools });
  } catch (error) {
    debugError('Dashboard summary error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
