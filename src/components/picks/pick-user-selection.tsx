'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { loadUsers } from '@/actions/loadUsers';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { loadPool } from '@/actions/loadPools';
import { userSessionManager } from '@/lib/user-session';

interface PickUserSelectionProps {
  poolId: string;
  weekNumber?: number;
  onUserSelected: (userId: string, userName: string) => void;
}

export function PickUserSelection({ poolId, weekNumber, onUserSelected }: PickUserSelectionProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [poolRequiresAccessCode, setPoolRequiresAccessCode] = useState(true);
  
  const { toast } = useToast();

  // Handle SSR - only run on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      loadData();
    }
  }, [isMounted, poolId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load pool details to check access code requirement
      const pool = await loadPool(poolId);
      if (pool) {
        setPoolRequiresAccessCode(pool.require_access_code);
      }
      
      // Use provided week number or load current week
      let weekToUse = weekNumber;
      if (!weekToUse) {
        const weekData = await loadCurrentWeek();
        weekToUse = weekData?.week_number || 1;
      }
      setCurrentWeek(weekToUse);
      
      // Load users who haven't submitted picks
      const availableUsers = await loadUsers(poolId, weekToUse);
      setUsers(availableUsers);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAccess = async () => {
    if (!selectedUserId) {
      toast({
        title: 'Error',
        description: 'Please select a user',
        variant: 'destructive',
      });
      return;
    }

    if (poolRequiresAccessCode && !accessCode) {
      toast({
        title: 'Error',
        description: 'Please enter the access code',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);

    try {
      const selectedUser = users.find(u => u.id === selectedUserId);
      if (!selectedUser) {
        throw new Error('User not found');
      }

      // Only verify access code if pool requires it
      if (poolRequiresAccessCode) {
        // For now, we'll use a simple verification
        // In a real app, you might want to store access codes in the database
        const expectedCode = selectedUser.name.substring(0, 4).toUpperCase();
        
        if (accessCode.toUpperCase() !== expectedCode) {
          toast({
            title: 'Access Denied',
            description: 'Invalid access code',
            variant: 'destructive',
          });
          return;
        }
      }

      // Create session
      const session = userSessionManager.createSession(
        selectedUser.id,
        selectedUser.name,
        poolId,
        selectedUser.pool_name || 'Unknown Pool',
        poolRequiresAccessCode ? accessCode : ''
      );

      toast({
        title: 'Access Granted',
        description: `Welcome, ${selectedUser.name}!`,
      });

      onUserSelected(selectedUser.id, selectedUser.name);
    } catch (error) {
      console.error('Error verifying access:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify access',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Don't render until mounted to prevent hydration errors
  if (!isMounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select User</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select User</CardTitle>
          <CardDescription>Loading users...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Participants Available</CardTitle>
          <CardDescription>
            {currentWeek ? `No participants found for Week ${currentWeek}` : 'No participants found in this pool'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-gray-500">
              {currentWeek ? 
                'All participants have already submitted their picks for this week!' :
                'No participants have been added to this pool yet.'
              }
            </p>
            {!currentWeek && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Admin Action Required:</strong> The pool administrator needs to add participants to this pool before picks can be made.
                </p>
                <p className="text-sm text-blue-700 mt-2">
                  Please contact the pool administrator or use the admin dashboard to add participants.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select User</CardTitle>
        <CardDescription>
          {poolRequiresAccessCode 
            ? `Choose your name and enter the access code to make your picks for Week ${currentWeek}`
            : `Choose your name to make your picks for Week ${currentWeek}`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="user-select">Your Name</Label>
          <select
            id="user-select"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">Select your name...</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>

        {poolRequiresAccessCode && (
          <div>
            <Label htmlFor="access-code">Access Code</Label>
            <Input
              id="access-code"
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Enter 4-character access code"
              maxLength={4}
            />
            <p className="text-sm text-gray-500 mt-1">
              Use the first 4 letters of your name as the access code
            </p>
          </div>
        )}

        <Button
          onClick={handleVerifyAccess}
          disabled={!selectedUserId || (poolRequiresAccessCode && !accessCode) || isVerifying}
          className="w-full"
        >
          {isVerifying ? 'Verifying...' : 'Continue'}
        </Button>
      </CardContent>
    </Card>
  );
}
