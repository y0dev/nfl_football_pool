'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLoadAction } from '@uibakery/data';
import loadUsersAction from '@/actions/loadUsers';
import { useAuth } from '@/lib/auth.tsx';
import { useToast } from '@/hooks/use-toast';
import { Trophy, User } from 'lucide-react';

interface UserOption {
  id: number;
  display_name: string;
  is_admin: boolean;
}

export function UserSelection() {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const [usersResult, loadingUsers] = useLoadAction(loadUsersAction, []);

  useEffect(() => {
    if (usersResult) {
      setUsers(usersResult);
    }
  }, [usersResult]);

  async function handleContinue() {
    if (!selectedUserId) {
      toast({
        title: 'Please select a user',
        description: 'You must select your name to continue',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    const selectedUser = users.find(u => u.id.toString() === selectedUserId);
    if (!selectedUser) {
      toast({
        title: 'Error',
        description: 'Selected user not found',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    // Simulate user login without password
    login({
      id: selectedUser.id,
      email: '', // Not needed for simplified auth
      display_name: selectedUser.display_name,
      is_admin: selectedUser.is_admin,
    });

    toast({
      title: 'Welcome!',
      description: `Logged in as ${selectedUser.display_name}`,
    });

    setIsLoading(false);
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center mb-2">
          <User className="h-8 w-8 text-blue-600" />
        </div>
        <CardTitle>Select Your Name</CardTitle>
        <CardDescription>Choose your name from the list to continue</CardDescription>
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
                <SelectItem key={user.id} value={user.id.toString()}>
                  {user.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button 
          onClick={handleContinue} 
          className="w-full" 
          disabled={isLoading || !selectedUserId}
        >
          {isLoading ? 'Please wait...' : 'Continue'}
        </Button>
        
        <div className="text-center text-xs text-gray-500 mt-4">
          Don't see your name? Contact the pool administrator.
        </div>
      </CardContent>
    </Card>
  );
}
