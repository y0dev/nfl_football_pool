'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { loadUsers } from '@/actions/loadUsers';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { userSessionManager } from '@/lib/user-session';
import { debugLog } from '@/lib/utils';

interface PickUserSelectionProps {
  poolId: string;
  weekNumber?: number;
  seasonType?: number;
  onUserSelected: (userId: string, userName: string) => void;
}

export function PickUserSelection({ poolId, weekNumber, seasonType, onUserSelected }: PickUserSelectionProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  
  const { toast } = useToast();

  // Handle SSR - only run on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      loadData();
    }
  }, [isMounted, poolId, weekNumber, seasonType]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Use provided week number or load current week
      let weekToUse = weekNumber;
      if (!weekToUse) {
        const weekData = await loadCurrentWeek();
        weekToUse = weekData?.week_number || 1;
      }
      setCurrentWeek(weekToUse);
      
      // Load users who haven't submitted picks for this specific pool, week, and season type
      const availableUsers = await loadUsers(poolId, weekToUse, seasonType || 2);
      
      // Ensure we have an array of users
      if (Array.isArray(availableUsers)) {
        setUsers(availableUsers);
      } else {
        console.error('loadUsers returned non-array:', availableUsers);
        setUsers([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setUsers([]);
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

    setIsVerifying(true);

    try {
      const selectedUser = users.find(u => u.id === selectedUserId);
      if (!selectedUser) {
        throw new Error('User not found');
      }

      debugLog('PickUserSelection: Creating session for user:', selectedUser);
      
      // Create session
      userSessionManager.createSession(
        selectedUser.id,
        selectedUser.name,
        poolId,
        '' // Empty access code since we no longer use them
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
                  <strong>Commissioner Action Required:</strong> The pool commissioner needs to add participants to this pool before picks can be made.
                </p>
                <p className="text-sm text-blue-700 mt-2">
                  Please contact the pool commissioner or use the commissioner dashboard to add participants.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Safety check - ensure users is an array
  if (!Array.isArray(users)) {
    console.error('Users is not an array:', users);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Participants</CardTitle>
          <CardDescription>There was an error loading the participant list.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-600">
            <p>Failed to load participants. Please refresh the page and try again.</p>
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
          {`Choose your name to make your picks for Week ${currentWeek}`}
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

        <Button
          onClick={handleVerifyAccess}
          disabled={!selectedUserId || isVerifying}
          className="w-full"
        >
          {isVerifying ? 'Verifying...' : 'Continue'}
        </Button>
      </CardContent>
    </Card>
  );
}
