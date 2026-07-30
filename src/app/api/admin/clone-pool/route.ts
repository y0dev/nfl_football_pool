import { NextRequest, NextResponse } from 'next/server';
import { adminClonePool } from '@/actions/clonePool';
import { debugError } from '@/lib/utils';

// Super-admin only. Clones a pool on behalf of its owning commissioner —
// see adminClonePool for why the caller doesn't need to own the pool.
export async function POST(request: NextRequest) {
  try {
    const callerEmail = request.headers.get('x-admin-email');
    if (!callerEmail) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { poolId, newName } = await request.json();
    if (!poolId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const result = await adminClonePool(poolId, callerEmail, newName);

    if (!result.success) {
      const status = result.error === 'Insufficient permissions.' ? 403 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    debugError('Admin clone pool error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
