import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { debugError } from '@/lib/utils';

export const NOTIFICATION_KEYS = ['pick_reminders', 'weekly_summaries', 'season_announcements', 'product_updates'] as const;
export type NotificationKey = typeof NOTIFICATION_KEYS[number];
export type NotificationPreferences = Record<NotificationKey, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pick_reminders: true,
  weekly_summaries: true,
  season_announcements: true,
  product_updates: true,
};

// Commissioner-only — super-admins don't have this column (see
// docs/migrations/add-account-settings-columns.sql).
export async function POST(request: NextRequest) {
  try {
    const { adminId, preferences } = await request.json();
    if (!adminId || !preferences || typeof preferences !== 'object') {
      return NextResponse.json({ success: false, error: 'Missing adminId or preferences' }, { status: 400 });
    }

    // Only accept known keys with boolean values — never trust arbitrary
    // client JSON straight into a JSONB column.
    const sanitized: NotificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    for (const key of NOTIFICATION_KEYS) {
      if (typeof preferences[key] === 'boolean') sanitized[key] = preferences[key];
    }

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from('commissioners')
      .update({ notification_preferences: sanitized, updated_at: new Date().toISOString() })
      .eq('id', adminId);

    if (error) {
      debugError('Save notification preferences error:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to save preferences' }, { status: 500 });
    }

    return NextResponse.json({ success: true, preferences: sanitized });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
