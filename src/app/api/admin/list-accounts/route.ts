import { NextRequest, NextResponse } from 'next/server';
import { findAccountByEmail } from '@/lib/accounts';
import { adminService } from '@/lib/admin-service';
import { debugError } from '@/lib/utils';

// Server-only replacement for the super-admin dashboard's direct
// client-side adminService.getAdmins() call — this lists every
// admin/commissioner account (email, name, active status), so it must
// stay super-admin-gated, verified from the DB rather than trusted from
// the client.
export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const account = await findAccountByEmail(adminEmail, { activeOnly: true });
    if (!account || account.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const admins = await adminService.getAdmins();
    return NextResponse.json({ success: true, admins });
  } catch (error) {
    debugError('List accounts error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load accounts' }, { status: 500 });
  }
}
