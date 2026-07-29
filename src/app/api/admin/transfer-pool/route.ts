import { NextRequest, NextResponse } from 'next/server';
import { transferPoolToCommissioner } from '@/lib/poolTransfer';
import { debugError } from '@/lib/utils';

// Super-admin only. Immediate, no approval needed — a super admin can
// already see every account, so there's no identity ambiguity to resolve
// (contrast with /api/huddle-transfers, the commissioner-facing equivalent
// that requires both parties to confirm by email).
export async function POST(request: NextRequest) {
  try {
    const callerEmail = request.headers.get('x-admin-email');
    if (!callerEmail) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { poolId, newCommissionerEmail, removeFromSourceRoster } = await request.json();
    if (!poolId || !newCommissionerEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await transferPoolToCommissioner(poolId, newCommissionerEmail, callerEmail, Boolean(removeFromSourceRoster));

    if (!result.success) {
      const status = result.error === 'Insufficient permissions.' ? 403 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json({
      success: true,
      message: `Pool "${result.poolName}" has been transferred to ${result.toEmail}`,
      pool: {
        id: result.poolId,
        name: result.poolName,
        previousOwner: result.fromEmail,
        newOwner: result.toEmail,
        huddleId: result.huddleId,
        huddleName: result.huddleName,
        mergedMembers: result.mergedMembers,
        removedFromSourceRoster: result.removedFromSourceRoster,
      },
    });
  } catch (error) {
    debugError('Transfer pool error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
