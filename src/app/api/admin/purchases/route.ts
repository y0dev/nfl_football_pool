import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseHistory } from '@/lib/subscription';

export async function GET(request: NextRequest) {
  const adminId = request.nextUrl.searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'Missing adminId' }, { status: 400 });
  }

  const purchases = await getPurchaseHistory(adminId);
  return NextResponse.json({ success: true, purchases });
}
