'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { joinPool } from '@/actions/joinPool';
import { useAuth } from '@/lib/auth';
import { UserPlus } from 'lucide-react';

interface JoinPoolButtonProps {
  poolId: string;
  onJoined: () => void;
}

export function JoinPoolButton({ poolId, onJoined }: JoinPoolButtonProps) {
  const [isJoining, setIsJoining] = useState(false);
  const { user } = useAuth();

  async function handleJoin() {
    if (!user) return;

    setIsJoining(true);
    try {
      await joinPool(poolId, user.id || '');
      console.log('Successfully joined pool');
      onJoined();
    } catch (error) {
      console.error('Failed to join pool:', error);
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
