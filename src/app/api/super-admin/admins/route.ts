import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

// Lists every account, super-admins and commissioners together (see
// scripts/migrate-commissioners.ts) — commissioners never have
// is_super_admin, so it's set to false when merging them in.
export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();

    const [adminsResult, commissionersResult] = await Promise.all([
      supabase.from('admins').select('*'),
      supabase.from('commissioners').select('*'),
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
