'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { sendPickReminders, getParticipantsWithoutPicks, testEmailConfiguration } from '@/actions/emailActions';

interface EmailManagementProps {
  poolId: string;
  weekNumber: number;
  adminId: string;
  poolName: string;
}

export function EmailManagement({ poolId, weekNumber, adminId, poolName }: EmailManagementProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [deadline, setDeadline] = useState('Sunday at kickoff');
  const [customMessage, setCustomMessage] = useState('');
  const [participantsWithoutPicks, setParticipantsWithoutPicks] = useState<any[]>([]);
  const [emailStatus, setEmailStatus] = useState<{
    sent: number;
    failed: number;
    total: number;
    message: string;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const { toast } = useToast();

  // Handle SSR - only run on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadParticipantsWithoutPicks = async () => {
    try {
      const participants = await getParticipantsWithoutPicks(poolId, weekNumber);
      setParticipantsWithoutPicks(participants);
    } catch (error) {
      console.error('Error loading participants:', error);
      toast({
        title: 'Error',
        description: 'Failed to load participants',
        variant: 'destructive',
      });
    }
  };

  const handleSendReminders = async () => {
    setIsLoading(true);
    setEmailStatus(null);

    try {
      const result = await sendPickReminders({
        poolId,
        weekNumber,
        adminId,
        deadline,
        poolUrl: `${window.location.origin}/picks?pool=${poolId}&week=${weekNumber}`
      });

      setEmailStatus({
        sent: result.sent,
        failed: result.failed,
        total: result.total,
        message: result.message
      });

      if (result.success) {
        toast({
          title: 'Reminders Sent',
          description: result.message,
        });
        // Reload participants list
        await loadParticipantsWithoutPicks();
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending reminders:', error);
      toast({
        title: 'Error',
        description: 'Failed to send reminders',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTesting(true);

    try {
      const result = await testEmailConfiguration();
      
      if (result.success) {
        toast({
          title: 'Test Email Sent',
          description: result.message,
        });
      } else {
        toast({
          title: 'Test Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error testing email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test email',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Load participants on component mount (client side only)
  useEffect(() => {
    if (isMounted) {
      loadParticipantsWithoutPicks();
    }
  }, [isMounted, poolId, weekNumber]);

  // Don't render until mounted to prevent hydration errors
  if (!isMounted) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>📧 Email Reminders</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📧 Email Reminders
          </CardTitle>
          <CardDescription>
            Send pick reminders to participants who haven't submitted their picks for Week {weekNumber}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="e.g., Sunday at kickoff"
              />
            </div>
            <div>
              <Label htmlFor="customMessage">Custom Message (Optional)</Label>
              <Textarea
                id="customMessage"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Add a custom message to the email..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSendReminders}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Sending...' : `Send Reminders (${participantsWithoutPicks.length})`}
            </Button>
            <Button
              onClick={handleTestEmail}
              disabled={isTesting}
              variant="outline"
            >
              {isTesting ? 'Testing...' : 'Test Email'}
            </Button>
          </div>

          {emailStatus && (
            <div className={`p-4 rounded-lg ${
              emailStatus.failed > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'
            }`}>
              <h4 className="font-medium mb-2">
                {emailStatus.failed > 0 ? '⚠️ Reminders Sent with Errors' : '✅ Reminders Sent Successfully'}
              </h4>
              <p className="text-sm">
                {emailStatus.message}
              </p>
              <div className="flex gap-4 mt-2 text-sm">
                <span>📤 Sent: {emailStatus.sent}</span>
                <span>❌ Failed: {emailStatus.failed}</span>
                <span>📊 Total: {emailStatus.total}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participants Without Picks</CardTitle>
          <CardDescription>
            These participants haven't submitted their picks for Week {weekNumber}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {participantsWithoutPicks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>🎉 All participants have submitted their picks!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {participantsWithoutPicks.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{participant.name}</p>
                    <p className="text-sm text-gray-600">{participant.email}</p>
                  </div>
                  <Badge variant="secondary">No Picks</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Template Preview</CardTitle>
          <CardDescription>
            This is what participants will receive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="space-y-2 text-sm">
              <p><strong>Subject:</strong> 🏈 NFL Confidence Pool - Week {weekNumber} Picks Due!</p>
              <Separator />
              <p><strong>Recipients:</strong> {participantsWithoutPicks.length} participants</p>
              <p><strong>Pool:</strong> {poolName}</p>
              <p><strong>Week:</strong> {weekNumber}</p>
              <p><strong>Deadline:</strong> {deadline}</p>
              <p><strong>Games:</strong> {participantsWithoutPicks.length > 0 ? '16' : '0'} games to pick</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
