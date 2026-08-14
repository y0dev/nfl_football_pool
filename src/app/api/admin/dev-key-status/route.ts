import { NextRequest, NextResponse } from 'next/server';
import { findAccountByEmail } from '@/lib/accounts';

const STALE_KEY_DAYS = 30;

// Read-only companion to /api/admin/dev-reset-password — lets the
// Development Tools card (src/app/admin/account/page.tsx) show whether
// DEV_MASTER_KEY is configured and how stale it is, without ever exposing
// the key itself. Same dev-only + super-admin gating as the reset route.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Not available' }, { status: 403 });
  }

  const adminEmail = request.headers.get('x-admin-email');
  if (!adminEmail) {
    return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
  }

  const account = await findAccountByEmail(adminEmail, { activeOnly: true });
  if (!account || account.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  const configured = !!process.env.DEV_MASTER_KEY;
  const rotatedAtRaw = process.env.DEV_MASTER_KEY_ROTATED_AT;
  let ageDays: number | null = null;
  if (rotatedAtRaw) {
    const parsed = new Date(rotatedAtRaw);
    if (!isNaN(parsed.getTime())) {
      ageDays = Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  const stale = configured && (ageDays === null || ageDays >= STALE_KEY_DAYS);

  return NextResponse.json({ success: true, configured, rotatedAt: rotatedAtRaw ?? null, ageDays, stale });
}
