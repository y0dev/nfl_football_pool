'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMutateAction } from '@uibakery/data';
import joinPoolAction from '@/actions/joinPool';
import { useAuth } from '@/lib/auth.tsx';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';

interface JoinPoolButtonProps {
  poolId: number;
  poolName: string;
  onJoined: () => void;
}

export function JoinPoolButton({ poolId, poolName, onJoined }: JoinPoolButtonProps) {
  const [isJoining, setIsJoining] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [joinPool] = useMutateAction(joinPoolAction);

  async function handleJoin() {
    if (!user) return;

    setIsJoining(true);
    try {
      await joinPool({
        poolId,
        userId: user.id,
      });

      toast({
        title: 'Successfully Joined!',
        description: `You've joined ${poolName}. Good luck with your picks!`,
      });

      onJoined();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to join pool. You may already be a member.',
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <Button 
      onClick={handleJoin} 
      disabled={isJoining} 
      className="w-full"
    >
      <UserPlus className="h-4 w-4 mr-2" />
      {isJoining ? 'Joining...' : 'Join Pool'}
    </Button>
  );
}
