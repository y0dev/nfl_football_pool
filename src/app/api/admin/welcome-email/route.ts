import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { debugError } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { email, fullName } = await request.json();
    if (!email || !fullName) {
      return NextResponse.json({ success: false, error: 'Missing email or fullName' }, { status: 400 });
    }

    const sent = await emailService.sendAdminCreationNotification(email, fullName);
    return NextResponse.json({ success: sent });
  } catch (error) {
    debugError('[SH][AUTH][EMAIL] Welcome email error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
