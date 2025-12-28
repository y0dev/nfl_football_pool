import { NextRequest, NextResponse } from 'next/server';
import { checkAndSendUrgentReminders } from '@/actions/emailActions';

/**
 * API route to check for participants without picks when games start in <5 hours
 * and send urgent reminders to pool admins.
 * 
 * This should be called periodically (e.g., via cron job every hour)
 * or triggered manually by admins.
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization check here
    // For now, we'll allow it to be called without auth for cron jobs
    
    await checkAndSendUrgentReminders();
    
    return NextResponse.json({
      success: true,
      message: 'Urgent reminder check completed'
    });
  } catch (error) {
    console.error('Error checking urgent reminders:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// Also allow GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}

