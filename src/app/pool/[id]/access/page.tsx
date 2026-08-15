import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { checkPoolAccess, poolAccessCookieName } from '@/lib/pool-access';
import { PoolPasswordPrompt } from '@/components/pool/pool-password-prompt';

export default async function PoolAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { id: poolId } = await params;
  const { next } = await searchParams;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(poolAccessCookieName(poolId))?.value;
  const access = await checkPoolAccess(poolId, cookieValue);

  if (access.allowed) {
    redirect(next && next.startsWith('/') ? next : `/pool/${poolId}/picks`);
  }
  if (access.reason === 'not_found') notFound();

  return (
    <PoolPasswordPrompt
      poolId={poolId}
      poolName={access.pool.name}
      needsSetup={access.reason === 'no_password_configured'}
      next={next}
    />
  );
}
