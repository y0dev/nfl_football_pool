import { NextRequest, NextResponse } from 'next/server';
import { checkAndSendUrgentReminders } from '@/actions/emailActions';
import { debugError } from '@/lib/utils';

/**
 * [SH][API][PICKS] Check for participants without picks when games start in
 * <5 hours and send urgent reminders to pool admins. Called periodically by
 * an external cron (hourly), authenticated with CRON_SECRET.
 *
 * Auth: production requires the x-cron-secret header (or Bearer token) to
 * match CRON_SECRET — unset means the route is disabled in production.
 * Development allows unauthenticated calls for manual testing.
 */
function isAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('x-cron-secret')
    ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return header === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await checkAndSendUrgentReminders();

    return NextResponse.json({
      success: true,
      message: 'Urgent reminder check completed'
    });
  } catch (error) {
    debugError('Error checking urgent reminders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

// Also allow GET so cron services that only support GET can call it
export async function GET(request: NextRequest) {
  return POST(request);
}
