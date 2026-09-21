import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service';
import { requireSuperAdmin } from '@/lib/accounts';
import { getNFLSeasonYear, debugError } from '@/lib/utils';

interface InactivePoolTarget {
  email: string;
  name: string;
  poolNames: string[];
}

/**
 * A pool "hasn't been used" this season if either: no participants were
 * ever added to it, or participants exist but nobody — including the
 * commissioner — has ever submitted a pick in it. Picks live in a
 * different table per competition type (Confidence: picks, Pick'em:
 * pickem_picks, Survivor: survivor_picks), so all three are checked.
 * Grouped by commissioner — one email per commissioner even if they have
 * several qualifying pools this season.
 */
async function findInactivePoolTargets(): Promise<InactivePoolTarget[]> {
  const supabase = getSupabaseServiceClient();
  const season = getNFLSeasonYear();

  const { data: pools } = await supabase
    .from('pools')
    .select('id, name, created_by')
    .eq('season', season);

  if (!pools || pools.length === 0) return [];

  const poolIds = pools.map(p => p.id);

  const [participantsRes, confidencePicksRes, pickemPicksRes, survivorPicksRes] = await Promise.all([
    supabase.from('participants').select('pool_id').in('pool_id', poolIds),
    supabase.from('picks').select('pool_id').in('pool_id', poolIds),
    supabase.from('pickem_picks').select('pool_id').in('pool_id', poolIds),
    supabase.from('survivor_picks').select('pool_id').in('pool_id', poolIds),
  ]);

  const participantCountByPool = new Map<string, number>();
  (participantsRes.data ?? []).forEach(r => {
    participantCountByPool.set(r.pool_id, (participantCountByPool.get(r.pool_id) ?? 0) + 1);
  });

  const poolsWithAnyPick = new Set<string>();
  [...(confidencePicksRes.data ?? []), ...(pickemPicksRes.data ?? []), ...(survivorPicksRes.data ?? [])]
    .forEach(r => poolsWithAnyPick.add(r.pool_id));

  const unusedPools = pools.filter(p => {
    const hasParticipants = (participantCountByPool.get(p.id) ?? 0) > 0;
    return !hasParticipants || !poolsWithAnyPick.has(p.id);
  });

  if (unusedPools.length === 0) return [];

  const commissionerEmails = [...new Set(unusedPools.map(p => p.created_by))];
  const { data: commissioners } = await supabase
    .from('commissioners')
    .select('email, full_name')
    .eq('is_active', true)
    .in('email', commissionerEmails);

  const commissionerByEmail = new Map((commissioners ?? []).map(c => [c.email, c]));

  const poolNamesByEmail = new Map<string, string[]>();
  unusedPools.forEach(p => {
    // Only active commissioner accounts — a deactivated/deleted owner
    // shouldn't get emailed about a pool they no longer manage.
    if (!commissionerByEmail.has(p.created_by)) return;
    if (!poolNamesByEmail.has(p.created_by)) poolNamesByEmail.set(p.created_by, []);
    poolNamesByEmail.get(p.created_by)!.push(p.name);
  });

  return [...poolNamesByEmail.entries()].map(([email, poolNames]) => ({
    email,
    name: commissionerByEmail.get(email)?.full_name || 'Commissioner',
    poolNames,
  }));
}

// Preview only — lets the admin UI show who/how many before actually sending.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const targets = await findInactivePoolTargets();
    return NextResponse.json({ success: true, targets, season: getNFLSeasonYear() });
  } catch (e) {
    debugError('Error previewing inactive pool feedback targets:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Recomputes the same target list server-side (never trusts a client-
// supplied list) and actually sends.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const targets = await findInactivePoolTargets();
    if (targets.length === 0) {
      return NextResponse.json({ success: true, sent: 0, total: 0 });
    }

    const { emailService } = await import('@/lib/email');
    let sent = 0;
    for (const target of targets) {
      try {
        await emailService.sendInactivePoolFeedbackRequest(target.email, target.name, target.poolNames);
        sent++;
      } catch (e) {
        debugError('Inactive-pool feedback email failed for:', target.email, e);
      }
    }

    return NextResponse.json({ success: true, sent, total: targets.length });
  } catch (e) {
    debugError('Send inactive pool feedback error:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
