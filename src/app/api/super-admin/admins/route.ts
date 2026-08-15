import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';

// Lists every account, super-admins and commissioners together (see
// scripts/migrate-commissioners.ts) — commissioners never have
// is_super_admin, so it's set to false when merging them in.
//
// Was previously completely unauthenticated AND selected every column
// (including password_hash) — anyone who knew the URL could dump every
// account's bcrypt hash with no login at all. The caller must now prove
// they're an active super admin first, and the select is narrowed to only
// what AdminDomainMapper.fromApi (src/lib/admin-domain.mapper.ts) actually
// reads — no reason to ship password hashes to the browser even for an
// authorized caller.
const ADMIN_COLUMNS = 'id, email, full_name, is_super_admin, is_active, created_at, plan, trial_ends_at, billing_exempt';
const COMMISSIONER_COLUMNS = 'id, email, full_name, is_active, created_at, plan, trial_ends_at, billing_exempt';

export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail) {
      return NextResponse.json({ success: false, error: 'No admin email header' }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();

    const { data: currentAdmin } = await supabase
      .from('admins')
      .select('is_super_admin, is_active')
      .eq('email', adminEmail)
      .eq('is_active', true)
      .single();

    if (!currentAdmin?.is_super_admin) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const [adminsResult, commissionersResult] = await Promise.all([
      supabase.from('admins').select(ADMIN_COLUMNS),
      supabase.from('commissioners').select(COMMISSIONER_COLUMNS),
    ]);

    if (adminsResult.error) {
      return NextResponse.json(
        { success: false, error: adminsResult.error.message },
        { status: 500 }
      );
    }
    if (commissionersResult.error) {
      return NextResponse.json(
        { success: false, error: commissionersResult.error.message },
        { status: 500 }
      );
    }

    const commissioners = (commissionersResult.data ?? []).map(c => ({ ...c, is_super_admin: false }));
    const admins = [...(adminsResult.data ?? []), ...commissioners]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      success: true,
      admins
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
