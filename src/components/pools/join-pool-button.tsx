'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { joinPoolServer } from '@/actions/joinPoolServer';
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
  const router = useRouter();

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (user === null) {
      router.push('/admin/login');
    }
  }, [user, router]);

  useEffect(() => {
    const checkIfInPool = async () => {
      
      if (!user?.email) {
        setIsChecking(false);
        return;
      }

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
      toast({
        title: "Error",
        description: "You must be logged in to join a pool",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    try {
      const result = await joinPoolServer(poolId, user.email, user.full_name);
      
      if (result.success) {
        console.log('Successfully joined pool');
        setIsInPool(true);
        onJoined();
        toast({
          title: "Success",
          description: "Successfully joined the pool!",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to join pool",
          variant: "destructive",
        });
      }
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

  // Don't render anything if user is not authenticated
  if (user === null) {
    return null;
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
