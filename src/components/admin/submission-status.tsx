'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { getUsersWhoSubmitted } from '@/actions/checkUserSubmission';
import { loadUsers } from '@/actions/loadUsers';
import { CheckCircle, Clock, Users } from 'lucide-react';

interface SubmissionStatusProps {
  poolId: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export function SubmissionStatus({ poolId }: SubmissionStatusProps) {
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [submittedUsers, setSubmittedUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Get current week
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || null);
        
        if (weekData) {
          // Get users who have submitted
          const submittedIds = await getUsersWhoSubmitted(poolId, weekData.week_number);
          setSubmittedUsers(submittedIds);
          
          // Get all users
          const allUsersData = await loadUsers();
          setAllUsers(allUsersData);
        }
      } catch (error) {
        console.error('Error loading submission status:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [poolId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Users className="h-8 w-8 text-blue-600 mx-auto mb-2 animate-pulse" />
            <p className="text-gray-600">Loading submission status...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentWeek) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Week</h3>
          <p className="text-gray-600">There is no active week for submissions at this time.</p>
        </CardContent>
      </Card>
    );
  }

  const submittedCount = submittedUsers.length;
  const totalCount = allUsers.length;
  const pendingCount = totalCount - submittedCount;
  const submissionRate = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

  const submittedUserNames = allUsers
    .filter(user => submittedUsers.includes(user.id))
    .map(user => user.name);

  const pendingUserNames = allUsers
    .filter(user => !submittedUsers.includes(user.id))
    .map(user => user.name);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          Week {currentWeek} Submission Status
        </CardTitle>
        <CardDescription>
          Track which participants have submitted their picks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{submittedCount}</div>
            <div className="text-sm text-green-700">Submitted</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-sm text-yellow-700">Pending</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{submissionRate}%</div>
            <div className="text-sm text-blue-700">Completion Rate</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Submission Progress</span>
            <span>{submittedCount}/{totalCount}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${submissionRate}%` }}
            ></div>
          </div>
        </div>

        {/* Submitted Users */}
        {submittedUserNames.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <h4 className="font-medium text-green-900">Submitted ({submittedUserNames.length})</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {submittedUserNames.map((name, index) => (
                <Badge key={index} variant="secondary" className="bg-green-100 text-green-800">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Pending Users */}
        {pendingUserNames.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <h4 className="font-medium text-yellow-900">Pending ({pendingUserNames.length})</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingUserNames.map((name, index) => (
                <Badge key={index} variant="outline" className="border-yellow-300 text-yellow-700">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* All Submitted Message */}
        {submittedCount === totalCount && totalCount > 0 && (
          <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h4 className="font-semibold text-green-900 mb-1">All Picks Submitted!</h4>
            <p className="text-green-700 text-sm">
              All {totalCount} participants have submitted their picks for Week {currentWeek}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
