import { redirect } from 'next/navigation';

// /pool/[id] has no page.tsx of its own (only its subroutes — picks,
// leaderboard, history, etc. — do), so redirecting there 404s. The real
// pool-management workspace is /league/pool/[id], which already grants
// access to both the owning commissioner and any super admin.
export default async function PoolAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/league/pool/${id}`);
}
