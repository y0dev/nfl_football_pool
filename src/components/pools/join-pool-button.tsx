'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { joinPoolServer } from '@/actions/joinPoolServer';
import { isUserInPool } from '@/actions/checkUserSubmission';
import { useAuth } from '@/lib/auth';
import { UserPlus, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const green   = 'oklch(46% 0.14 155)';
const border  = 'oklch(26% 0.03 255)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;

interface JoinPoolButtonProps {
  poolId: string;
  onJoined: () => void;
}

export function JoinPoolButton({ poolId, onJoined }: JoinPoolButtonProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [isInPool, setIsInPool] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.push('/admin/login');
  }, [user, router]);

  useEffect(() => {
    const checkIfInPool = async () => {
      if (!user?.email) { setIsChecking(false); return; }
      try {
        const inPool = await isUserInPool(user.email, poolId);
        setIsInPool(inPool);
      } catch (error) {
        console.error('Error checking if user is in pool:', error);
      } finally {
        setIsChecking(false);
      }
    };
    checkIfInPool();
  }, [user?.email, poolId]);

  async function handleJoin() {
    if (!user?.email) {
      toast({ title: 'Error', description: 'You must be logged in to join a pool', variant: 'destructive' });
      return;
    }
    setIsJoining(true);
    try {
      const result = await joinPoolServer(poolId, user.email, user.full_name);
      if (result.success) {
        setIsInPool(true);
        onJoined();
        toast({ title: 'Success', description: 'Successfully joined the pool!' });
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to join pool', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to join pool:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to join pool', variant: 'destructive' });
    } finally {
      setIsJoining(false);
    }
  }

  if (user === null) return null;

  const btnStyle = (disabled: boolean, variant: 'primary' | 'outline' = 'primary') => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.4rem 0.85rem', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
    ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' as const,
    border: `1px solid ${variant === 'primary' ? green : border}`,
    background: disabled ? border : (variant === 'primary' ? green : 'transparent'),
    color: disabled ? textDim : (variant === 'primary' ? text : textMid),
  });

  if (isChecking) {
    return (
      <button disabled style={btnStyle(true)}>
        <Loader2 style={{ width: 13, height: 13, animation: 'spin 0.8s linear infinite' }} />
        Checking...
      </button>
    );
  }

  if (isInPool) {
    return (
      <button disabled style={btnStyle(true, 'outline')}>
        <Check style={{ width: 13, height: 13 }} />
        Joined
      </button>
    );
  }

  return (
    <button onClick={handleJoin} disabled={isJoining} style={btnStyle(isJoining)}>
      {isJoining
        ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 0.8s linear infinite' }} />
        : <UserPlus style={{ width: 13, height: 13 }} />
      }
      {isJoining ? 'Joining...' : 'Join Pool'}
    </button>
  );
}
