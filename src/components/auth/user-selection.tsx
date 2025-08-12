'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadUsers } from '@/actions/loadUsers';
import { useAuth } from '@/lib/auth';
import { Trophy, User } from 'lucide-react';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface UserSelectionProps {
  poolId?: string;
  week?: number;
  onUserSelected?: (user: UserOption) => void;
}

export function UserSelection({ poolId, week, onUserSelected }: UserSelectionProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const { login } = useAuth();

  useEffect(() => {
    async function fetchUsers() {
      try {
        const usersData = await loadUsers(poolId, week);
        setUsers(usersData);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, [poolId, week]);

  async function handleContinue() {
    if (!selectedUserId) {
      console.error('Please select a user');
      return;
    }

    setIsLoading(true);
    
    const selectedUser = users.find(u => u.id === selectedUserId);
    if (!selectedUser) {
      console.error('Selected user not found');
      setIsLoading(false);
      return;
    }

    // Call the callback if provided
    if (onUserSelected) {
      onUserSelected(selectedUser);
    } else {
      // Default behavior: simulate user login without password
      login(selectedUser.email, '');
      console.log(`Logged in as ${selectedUser.name}`);
    }

    setIsLoading(false);
  }

  if (loadingUsers) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Trophy className="h-8 w-8 text-blue-600 mx-auto mb-2 animate-pulse" />
            <p className="text-gray-600">Loading users...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="text-center py-8">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Available Users</h3>
          <p className="text-gray-600">
            {poolId && week 
              ? "All users have already submitted their picks for this week."
              : "No users are available at this time."
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center mb-2">
          <User className="h-8 w-8 text-blue-600" />
        </div>
        <CardTitle>Select Your Name</CardTitle>
        <CardDescription>
          {poolId && week 
            ? `Choose your name to submit picks for Week ${week}`
            : "Choose your name from the list to continue"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="user-select" className="text-sm font-medium">
            Your Name
          </label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Select your name..." />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button 
          onClick={handleContinue} 
          disabled={!selectedUserId || isLoading}
          className="w-full"
        >
          {isLoading ? 'Loading...' : 'Continue'}
        </Button>
      </CardContent>
    </Card>
  );
}
