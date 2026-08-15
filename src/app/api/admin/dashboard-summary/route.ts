import { NextRequest, NextResponse } from 'next/server';
import { findAccountByEmail } from '@/lib/accounts';
import { adminService } from '@/lib/admin-service';
import { debugError } from '@/lib/utils';

// Server-only replacement for the commissioner/super-admin dashboards'
// direct client-side AdminService usage (which required shipping the
// Supabase service role key to the browser). Role is resolved from the DB
// here, never trusted from the client, unlike the AdminService calls this
// replaces.
export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') ?? '', 10);
    const seasonType = parseInt(searchParams.get('seasonType') ?? '', 10);
    if (isNaN(week) || isNaN(seasonType)) {
      return NextResponse.json({ success: false, error: 'week and seasonType are required' }, { status: 400 });
    }

    const account = await findAccountByEmail(adminEmail, { activeOnly: true });
    if (!account) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }
    const isSuperAdmin = account.role === 'super_admin';

    const [stats, pools] = await Promise.all([
      adminService.getDashboardStats(week, seasonType, adminEmail, isSuperAdmin),
      adminService.getActivePools(adminEmail, isSuperAdmin),
    ]);

    return NextResponse.json({ success: true, stats, pools });
  } catch (error) {
    debugError('Dashboard summary error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
