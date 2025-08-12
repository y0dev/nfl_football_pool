import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // Get all admins
    const { data: admins, error } = await supabase
      .from('admins')
      .select('id, email, full_name, is_super_admin, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admins:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch admins' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      admins: admins || []
    });

  } catch (error) {
    console.error('Error in admins API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
