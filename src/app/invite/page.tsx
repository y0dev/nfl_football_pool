'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Trophy, Users, Calendar, Mail, UserPlus, Shield, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loadPool } from '@/actions/loadPools';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';

interface Pool {
  id: string;
  name: string;
  created_by: string;
  require_access_code: boolean;
  is_active: boolean;
  created_at: string;
}

function InviteContent() {
  const searchParams = useSearchParams();
  const poolId = searchParams.get('pool');
  const adminEmail = searchParams.get('admin');
  const weekParam = searchParams.get('week');
  
  const [pool, setPool] = useState<Pool | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isJoining, setIsJoining] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [joinSuccess, setJoinSuccess] = useState(false);
  
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        if (!poolId) {
          setError('Invalid invitation link. Pool ID is missing.');
          return;
        }

        // Load pool information
        const poolData = await loadPool(poolId);
        if (!poolData) {
          setError('Pool not found. This invitation may be invalid or the pool may have been deleted.');
          return;
        }

        if (!poolData.is_active) {
          setError('This pool is currently inactive and not accepting new participants.');
          return;
        }

        setPool(poolData);

        // Load current week
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || 1);

      } catch (error) {
        console.error('Error loading invite data:', error);
        setError('Failed to load pool information. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [poolId]);

  const handleJoinPool = async () => {
    if (!pool) return;

    // Validate inputs
    if (!participantName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name to join the pool.",
        variant: "destructive",
      });
      return;
    }

    if (!participantEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    if (pool.require_access_code && !accessCode.trim()) {
      toast({
        title: "Access Code Required",
        description: "This pool requires an access code to join.",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();

      // Check if participant already exists
      const { data: existingParticipant } = await supabase
        .from('participants')
        .select('id')
        .eq('pool_id', pool.id)
        .eq('email', participantEmail.trim().toLowerCase())
        .single();

      if (existingParticipant) {
        toast({
          title: "Already Joined",
          description: "You have already joined this pool. You can now make your picks!",
        });
        // Redirect to participant page
        router.push(`/participant?pool=${pool.id}&week=${currentWeek}`);
        return;
      }

      // Create new participant
      const { data: newParticipant, error: joinError } = await supabase
        .from('participants')
        .insert({
          pool_id: pool.id,
          name: participantName.trim(),
          email: participantEmail.trim().toLowerCase(),
          is_active: true,
          joined_at: new Date().toISOString()
        })
        .select()
        .single();

      if (joinError) {
        throw joinError;
      }

      setJoinSuccess(true);
      toast({
        title: "Successfully Joined!",
        description: `Welcome to ${pool.name}! You can now make your picks for Week ${currentWeek}.`,
      });

      // Redirect to participant page after a short delay
      setTimeout(() => {
        router.push(`/participant?pool=${pool.id}&week=${currentWeek}`);
      }, 2000);

    } catch (error) {
      console.error('Error joining pool:', error);
      toast({
        title: "Join Failed",
        description: "Failed to join the pool. Please try again or contact the pool administrator.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Invitation Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (joinSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-green-600">Successfully Joined!</CardTitle>
            <CardDescription>
              Welcome to {pool?.name}! Redirecting you to make your picks...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="animate-pulse">
              <div className="h-2 bg-green-200 rounded-full mb-2"></div>
              <div className="text-sm text-green-600">Preparing your picks page...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl sm:text-2xl font-bold">Pool Invitation</h1>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Pool Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-blue-600" />
                {pool?.name}
              </CardTitle>
              <CardDescription>
                You've been invited to join this NFL Confidence Pool
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Pool Administrator: {adminEmail || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Current Week: {currentWeek}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <Badge variant={pool?.require_access_code ? "default" : "secondary"} className="text-xs">
                    {pool?.require_access_code ? "Access Code Required" : "No Access Code Required"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Join Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-green-600" />
                Join Pool
              </CardTitle>
              <CardDescription>
                Enter your information to join {pool?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium">Full Name *</Label>
                <Input
                  id="name"
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your full name"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="email" className="text-sm font-medium">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={participantEmail}
                  onChange={(e) => setParticipantEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="mt-1"
                />
              </div>
              
              {pool?.require_access_code && (
                <div>
                  <Label htmlFor="accessCode" className="text-sm font-medium">Access Code *</Label>
                  <Input
                    id="accessCode"
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Enter the access code"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This pool requires an access code. Please contact the pool administrator if you don't have one.
                  </p>
                </div>
              )}
              
              <Button
                onClick={handleJoinPool}
                disabled={isJoining}
                className="w-full flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {isJoining ? 'Joining Pool...' : 'Join Pool'}
              </Button>
              
              <div className="text-xs text-gray-500 text-center">
                By joining this pool, you agree to participate in the NFL Confidence Pool and follow the pool's rules.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
