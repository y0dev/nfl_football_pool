'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadUsers } from '@/actions/loadUsers';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { userSessionManager } from '@/lib/user-session';
import { User, Trophy, CheckCircle, Shield, AlertTriangle } from 'lucide-react';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface PickUserSelectionProps {
  poolId: string;
  onUserSelected: (user: UserOption) => void;
}

export function PickUserSelection({ poolId, onUserSelected }: PickUserSelectionProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingUsers(true);
        
        // Get current week
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || null);
        
        // Load users who haven't submitted picks yet
        const usersData = await loadUsers(poolId, weekData?.week_number);
        setUsers(usersData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchData();
  }, [poolId]);

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    setShowVerification(true);
    setVerificationError('');
  };

  const handleVerification = () => {
    if (!verificationCode.trim()) {
      setVerificationError('Please enter the verification code');
      return;
    }

    // Simple verification: check if code matches participant ID (first 4 characters)
    const selectedUser = users.find(u => u.id === selectedUserId);
    if (!selectedUser) {
      setVerificationError('User not found');
      return;
    }

    const expectedCode = selectedUser.id.substring(0, 4).toUpperCase();
    if (verificationCode.toUpperCase() !== expectedCode) {
      setVerificationError('Invalid verification code');
      return;
    }

    // Create secure session
    userSessionManager.createSession(selectedUser.id, selectedUser.name);
    
    // Call the callback
    onUserSelected(selectedUser);
    
    // Reset form
    setShowVerification(false);
    setVerificationCode('');
    setSelectedUserId('');
  };

  const handleCancelVerification = () => {
    setShowVerification(false);
    setVerificationCode('');
    setSelectedUserId('');
    setVerificationError('');
  };

  if (loadingUsers) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Trophy className="h-8 w-8 text-blue-600 mx-auto mb-2 animate-pulse" />
            <p className="text-gray-600">Loading available users...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="text-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">All Picks Submitted!</h3>
          <p className="text-gray-600">
            {currentWeek 
              ? `All users have already submitted their picks for Week ${currentWeek}.`
              : "All users have already submitted their picks for this week."
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  if (showVerification) {
    const selectedUser = users.find(u => u.id === selectedUserId);
    const expectedCode = selectedUser?.id.substring(0, 4).toUpperCase();

    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle>Verify Your Identity</CardTitle>
          <CardDescription>
            Please verify you are {selectedUser?.name} to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <Input
              id="verification-code"
              type="text"
              placeholder="Enter verification code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="text-center text-lg font-mono tracking-wider"
              maxLength={4}
            />
            <p className="text-xs text-gray-500 text-center">
              Hint: Check your email or ask the pool administrator for your verification code
            </p>
            {verificationError && (
              <div className="flex items-center space-x-2 text-red-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>{verificationError}</span>
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={handleCancelVerification}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleVerification}
              className="flex-1"
            >
              Verify & Continue
            </Button>
          </div>
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
          {currentWeek 
            ? `Choose your name to submit picks for Week ${currentWeek}`
            : "Choose your name to submit picks"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="user-select">Your Name</Label>
          <Select value={selectedUserId} onValueChange={handleUserSelect}>
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
        
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Security Notice</p>
              <p>You'll need to verify your identity before making picks. This prevents others from submitting picks on your behalf.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
