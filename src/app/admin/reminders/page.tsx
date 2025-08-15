'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ArrowLeft, Mail, Users, Clock, AlertTriangle, CheckCircle, RefreshCw, Send, Filter, Search, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { loadPools } from '@/actions/loadPools';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createMailtoUrl, openEmailClient, copyMailtoToClipboard, createReminderEmail, createSubmissionSummaryEmail } from '@/lib/mailto-utils';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Participant {
  id: string;
  name: string;
  email: string;
  pool_id: string;
  pool_name: string;
  is_active: boolean;
  created_at: string;
  has_submitted: boolean;
  last_reminder_sent?: string;
}

interface Pool {
  id: string;
  name: string;
  is_active: boolean;
}

function RemindersContent() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [filterSubmitted, setFilterSubmitted] = useState<'all' | 'submitted' | 'not_submitted'>('not_submitted');
  const [isSendingSummary, setIsSendingSummary] = useState(false);
  const [summaryEmail, setSummaryEmail] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (currentWeek && currentSeasonType) {
      loadParticipants();
    }
  }, [currentWeek, currentSeasonType, selectedPool]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load current week
      const weekData = await loadCurrentWeek();
      setCurrentWeek(weekData?.week_number || 1);
      setCurrentSeasonType(weekData?.season_type || 2);
      
      // Load pools
      await loadPoolsData();
      
      // Load participants
      await loadParticipants();
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reminder data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPoolsData = async () => {
    try {
      const poolsData = await loadPools();
      if (user?.is_super_admin) {
        setPools(poolsData);
      } else {
        // Filter pools to only show pools created by this admin
        const userPools = poolsData.filter(pool => pool.created_by === user?.email);
        setPools(userPools);
      }
    } catch (error) {
      console.error('Error loading pools:', error);
    }
  };

  const loadParticipants = async () => {
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      // Build query for participants
      let participantsQuery = supabase
        .from('participants')
        .select(`
          id,
          name,
          email,
          pool_id,
          is_active,
          created_at,
          pools!inner(name, created_by)
        `)
        .eq('is_active', true);

      // Filter by pool if selected
      if (selectedPool !== 'all') {
        participantsQuery = participantsQuery.eq('pool_id', selectedPool);
      } else if (!user?.is_super_admin) {
        // For non-super admins, only show participants from their pools
        // Get pools data directly since the state might not be updated yet
        const poolsData = await loadPools();
        const userPools = poolsData.filter(pool => pool.created_by === user?.email);
        const userPoolIds = userPools.map(p => p.id);
        participantsQuery = participantsQuery.in('pool_id', userPoolIds);
      }

      const { data: participantsData, error } = await participantsQuery;

      if (error) {
        console.error('Error loading participants:', error);
        return;
      }

      // Check submission status for each participant
      const participantsWithSubmissionStatus = await Promise.all(
        participantsData.map(async (participant) => {
          const { data: picks } = await supabase
            .from('picks')
            .select('id, games!inner(week, season_type)')
            .eq('participant_id', participant.id)
            .eq('games.week', currentWeek)
            .eq('games.season_type', currentSeasonType);

          const { data: reminders } = await supabase
            .from('reminder_logs')
            .select('created_at')
            .eq('participant_id', participant.id)
            .eq('week', currentWeek)
            .eq('season_type', currentSeasonType)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...participant,
            pool_name: (participant.pools as { name: string }[])[0]?.name || 'Unknown Pool',
            has_submitted: Boolean(picks && picks.length > 0),
            last_reminder_sent: reminders?.[0]?.created_at
          };
        })
      );

      setParticipants(participantsWithSubmissionStatus);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const filteredParticipants = participants.filter(participant => {
    // Filter by search term
    const matchesSearch = participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         participant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         participant.pool_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by submission status
    let matchesSubmissionFilter = true;
    if (filterSubmitted === 'submitted') {
      matchesSubmissionFilter = participant.has_submitted;
    } else if (filterSubmitted === 'not_submitted') {
      matchesSubmissionFilter = !participant.has_submitted;
    }
    
    return matchesSearch && matchesSubmissionFilter;
  });

  const handleSelectAll = () => {
    const notSubmittedParticipants = filteredParticipants.filter(p => !p.has_submitted);
    if (selectedParticipants.size === notSubmittedParticipants.length) {
      setSelectedParticipants(new Set());
    } else {
      setSelectedParticipants(new Set(notSubmittedParticipants.map(p => p.id)));
    }
  };

  const handleSelectParticipant = (participantId: string) => {
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(participantId)) {
      newSelected.delete(participantId);
    } else {
      newSelected.add(participantId);
    }
    setSelectedParticipants(newSelected);
  };

  const sendReminders = async () => {
    if (selectedParticipants.size === 0) {
      toast({
        title: 'No Participants Selected',
        description: 'Please select at least one participant to send reminders to',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingReminders(true);
    try {
      const selectedParticipantsData = participants.filter(p => selectedParticipants.has(p.id));
      const poolName = pools.find(p => p.id === selectedPool)?.name || 'NFL Pool';
      
      // Create reminder email using utility
      const emailOptions = createReminderEmail(poolName, currentWeek);
      emailOptions.bcc = selectedParticipantsData.map(p => p.email).join(',');
      
      const mailtoUrl = createMailtoUrl(emailOptions);

      // Try to open email client
      const opened = await openEmailClient(mailtoUrl);
      
      if (opened) {
        toast({
          title: 'Email Client Opened',
          description: `Email prepared for ${selectedParticipants.size} participant(s). Your email client should open automatically.`,
        });
      } else {
        // Fallback: copy mailto URL to clipboard
        const copied = await copyMailtoToClipboard(mailtoUrl);
        
        if (copied) {
          toast({
            title: 'Email URL Copied',
            description: `Email URL copied to clipboard. Paste it in your browser address bar to open your email client.`,
          });
        } else {
          toast({
            title: 'Manual Action Required',
            description: `Please copy this URL and paste it in your browser: ${mailtoUrl}`,
            variant: 'destructive',
          });
        }
      }
      
      // Clear selection and refresh data
      setSelectedParticipants(new Set());
      await loadParticipants();
    } catch (error) {
      console.error('Error preparing reminders:', error);
      toast({
        title: 'Error',
        description: 'Failed to prepare reminders',
        variant: 'destructive',
      });
    } finally {
      setIsSendingReminders(false);
      setShowConfirmDialog(false);
    }
  };

  const sendSubmissionSummary = async () => {
    if (!summaryEmail.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter an email address to send the summary to',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingSummary(true);
    try {
      const submittedParticipants = participants.filter(p => p.has_submitted);
      const notSubmittedParticipants = participants.filter(p => !p.has_submitted);
      const poolName = pools.find(p => p.id === selectedPool)?.name || 'NFL Pool';
      
      // Create submission summary email using utility
      const emailOptions = createSubmissionSummaryEmail(
        poolName,
        currentWeek,
        participants.length,
        submittedParticipants.length,
        submittedParticipants,
        notSubmittedParticipants
      );
      emailOptions.to = summaryEmail;
      
      const mailtoUrl = createMailtoUrl(emailOptions);

      // Try to open email client
      const opened = await openEmailClient(mailtoUrl);
      
      if (opened) {
        toast({
          title: 'Email Client Opened',
          description: `Submission summary prepared and sent to ${summaryEmail}. Your email client should open automatically.`,
        });
      } else {
        // Fallback: copy mailto URL to clipboard
        const copied = await copyMailtoToClipboard(mailtoUrl);
        
        if (copied) {
          toast({
            title: 'Email URL Copied',
            description: `Email URL copied to clipboard. Paste it in your browser address bar to open your email client.`,
          });
        } else {
          toast({
            title: 'Manual Action Required',
            description: `Please copy this URL and paste it in your browser: ${mailtoUrl}`,
            variant: 'destructive',
          });
        }
      }
      
      setSummaryEmail('');
    } catch (error) {
      console.error('Error preparing summary:', error);
      toast({
        title: 'Error',
        description: 'Failed to prepare summary',
        variant: 'destructive',
      });
    } finally {
      setIsSendingSummary(false);
    }
  };

  const getStats = () => {
    const total = participants.length;
    const submitted = participants.filter(p => p.has_submitted).length;
    const notSubmitted = total - submitted;
    const selected = selectedParticipants.size;
    
    return { total, submitted, notSubmitted, selected };
  };

  const stats = getStats();

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/dashboard')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Send Reminders</h1>
            <p className="text-sm sm:text-base text-gray-600">
              Send email reminders to participants who haven&apos;t submitted their picks for Week {currentWeek}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={loadData}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mx-auto mb-2" />
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs sm:text-sm text-gray-600">Total Participants</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mx-auto mb-2" />
              <div className="text-lg sm:text-2xl font-bold text-green-600">{stats.submitted}</div>
              <div className="text-xs sm:text-sm text-gray-600">Submitted</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 mx-auto mb-2" />
              <div className="text-lg sm:text-2xl font-bold text-orange-600">{stats.notSubmitted}</div>
              <div className="text-xs sm:text-sm text-gray-600">Need Reminders</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3 sm:p-4">
              <Mail className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 mx-auto mb-2" />
              <div className="text-lg sm:text-2xl font-bold text-purple-600">{stats.selected}</div>
              <div className="text-xs sm:text-sm text-gray-600">Selected</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Pool</label>
                <Select value={selectedPool} onValueChange={setSelectedPool}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select pool" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pools</SelectItem>
                    {pools.map((pool) => (
                      <SelectItem key={pool.id} value={pool.id}>
                        {pool.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filterSubmitted} onValueChange={(value: 'all' | 'submitted' | 'not_submitted') => setFilterSubmitted(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Participants</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="not_submitted">Not Submitted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search participants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex items-end">
                <Button
                  onClick={handleSelectAll}
                  variant="outline"
                  className="w-full"
                >
                  {selectedParticipants.size === filteredParticipants.filter(p => !p.has_submitted).length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </div>
            
                         {stats.selected > 0 && (
               <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                 <div className="flex items-center gap-2">
                   <Mail className="h-5 w-5 text-blue-600" />
                   <span className="text-blue-800 font-medium">
                     {stats.selected} participant{stats.selected !== 1 ? 's' : ''} selected for reminders
                   </span>
                 </div>
                 <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                   <AlertDialogTrigger asChild>
                     <Button
                       onClick={() => setShowConfirmDialog(true)}
                       disabled={isSendingReminders}
                       className="flex items-center gap-2"
                     >
                       <Send className="h-4 w-4" />
                       {isSendingReminders ? 'Sending...' : 'Send Reminders'}
                     </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                     <AlertDialogHeader>
                       <AlertDialogTitle>Send Reminders</AlertDialogTitle>
                       <AlertDialogDescription>
                         Are you sure you want to send reminder emails to {stats.selected} participant{stats.selected !== 1 ? 's' : ''}? 
                         This will notify them that they haven&apos;t submitted their picks for Week {currentWeek}.
                       </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                       <AlertDialogCancel>Cancel</AlertDialogCancel>
                       <AlertDialogAction onClick={sendReminders}>
                         Send Reminders
                       </AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                 </AlertDialog>
               </div>
             )}

             {/* Summary Email Section */}
             <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
               <div className="flex items-center gap-2 flex-1">
                 <BarChart3 className="h-5 w-5 text-green-600" />
                 <span className="text-green-800 font-medium">
                   Send Submission Summary
                 </span>
               </div>
               <div className="flex flex-col sm:flex-row gap-2">
                 <Input
                   type="email"
                   placeholder="Enter email address"
                   value={summaryEmail}
                   onChange={(e) => setSummaryEmail(e.target.value)}
                   className="w-full sm:w-64"
                 />
                 <Button
                   onClick={sendSubmissionSummary}
                   disabled={isSendingSummary || !summaryEmail.trim()}
                   className="flex items-center gap-2"
                 >
                   <BarChart3 className="h-4 w-4" />
                   {isSendingSummary ? 'Sending...' : 'Send Summary'}
                 </Button>
               </div>
             </div>
          </CardContent>
        </Card>

        {/* Participants List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Participants ({filteredParticipants.length})
            </CardTitle>
            <CardDescription>
              Select participants to send reminder emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredParticipants.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No participants found matching your filters</p>
                </div>
              ) : (
                filteredParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      participant.has_submitted ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={selectedParticipants.has(participant.id)}
                        onCheckedChange={() => handleSelectParticipant(participant.id)}
                        disabled={participant.has_submitted}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{participant.name}</h3>
                          {participant.has_submitted && (
                            <Badge variant="default" className="text-xs">Submitted</Badge>
                          )}
                          {!participant.has_submitted && (
                            <Badge variant="destructive" className="text-xs">Not Submitted</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{participant.email}</p>
                        <p className="text-xs text-gray-500">Pool: {participant.pool_name}</p>
                        {participant.last_reminder_sent && (
                          <p className="text-xs text-gray-500">
                            Last reminder: {new Date(participant.last_reminder_sent).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {participant.has_submitted ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-orange-600" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function RemindersPage() {
  return (
    <AuthProvider>
      <RemindersContent />
    </AuthProvider>
  );
}
