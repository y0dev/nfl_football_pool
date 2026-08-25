import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/accounts';
import { adminService } from '@/lib/admin-service';
import { debugError } from '@/lib/utils';

// Server-only replacement for the super-admin dashboard's direct
// client-side adminService.getAdmins() call — this lists every
// admin/commissioner account (email, name, active status), so it must
// stay super-admin-gated, verified from the DB rather than trusted from
// the client.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const admins = await adminService.getAdmins();
    return NextResponse.json({ success: true, admins });
  } catch (error) {
    debugError('List accounts error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load accounts' }, { status: 500 });
  }
}
