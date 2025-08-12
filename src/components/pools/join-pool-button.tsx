'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { joinPool } from '@/actions/joinPool';
import { isUserInPool } from '@/actions/checkUserSubmission';
import { useAuth } from '@/lib/auth';
import { UserPlus, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    const checkIfInPool = async () => {
      console.log('JoinPoolButton: Checking if user is in pool', { user, poolId });
      
      if (!user?.email) {
        console.log('JoinPoolButton: No user email, skipping check');
        setIsChecking(false);
        return;
      }

      try {
        const inPool = await isUserInPool(user.email, poolId);
        console.log('JoinPoolButton: User in pool check result:', inPool);
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
    console.log('JoinPoolButton: handleJoin called', { user, poolId });
    
    if (!user?.email) {
      console.log('JoinPoolButton: No user email, showing error');
      toast({
        title: "Error",
        description: "You must be logged in to join a pool",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    try {
      console.log('JoinPoolButton: Calling joinPool with:', { poolId, email: user.email, name: user.full_name });
      await joinPool(poolId, user.email, user.full_name);
      console.log('Successfully joined pool');
      setIsInPool(true);
      onJoined();
      toast({
        title: "Success",
        description: "Successfully joined the pool!",
      });
    } catch (error) {
      console.error('Failed to join pool:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join pool",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  }

  if (isChecking) {
    return (
      <Button disabled className="w-full">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        Checking...
      </Button>
    );
  }

  if (isInPool) {
    return (
      <Button disabled variant="outline" className="w-full">
        <Check className="h-4 w-4 mr-2" />
        Already Joined
      </Button>
    );
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
