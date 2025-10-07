'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  ArrowLeft,
  Search,
  Plus,
  Users,
  Trophy,
  Calendar,
  Activity,
  Settings,
  Eye,
  Edit,
  Trash2,
  Mail,
  BarChart3,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminService, Pool, Participant } from '@/lib/admin-service';
import { debugLog, createPageUrl, getMaxWeeksForSeason, MAX_WEEKS_POSTSEASON, MAX_WEEKS_PRESEASON, MAX_WEEKS_REGULAR_SEASON } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth';
import { SharedAdminGuard } from '@/components/auth/shared-admin-guard';
import { CreatePoolDialog } from '@/components/pools/create-pool-dialog';

interface PoolWithParticipants extends Pool {
  participantCount: number;
  activeParticipantCount: number;
  lastActivity?: string;
}

function PoolsManagementContent() {
  const { user, signOut, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pools, setPools] = useState<PoolWithParticipants[]>([]);
  const [filteredPools, setFilteredPools] = useState<PoolWithParticipants[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overridePool, setOverridePool] = useState<PoolWithParticipants | null>(null);
  const [overrideType, setOverrideType] = useState<'week' | 'quarter'>('week');
  const [overrideWeek, setOverrideWeek] = useState<string>('');
  const [overrideQuarter, setOverrideQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Playoffs'>('Q1');
  const [overrideSeason, setOverrideSeason] = useState<string>('');
  const [overrideSeasonType, setOverrideSeasonType] = useState<'Preseason' | 'Regular' | 'Postseason'>('Regular');
  const [overrideParticipantId, setOverrideParticipantId] = useState<string>('');
  const [overrideParticipantName, setOverrideParticipantName] = useState<string>('');
  const [overridePoints, setOverridePoints] = useState<string>('');
  const [overrideCorrect, setOverrideCorrect] = useState<string>('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);
  const [overrideParticipants, setOverrideParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedPoolForShare, setSelectedPoolForShare] = useState<PoolWithParticipants | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [createPoolDialogOpen, setCreatePoolDialogOpen] = useState(false);
  const [transferPoolDialogOpen, setTransferPoolDialogOpen] = useState(false);
  const [selectedPoolForTransfer, setSelectedPoolForTransfer] = useState<PoolWithParticipants | null>(null);
  const [newCommissionerEmail, setNewCommissionerEmail] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [stats, setStats] = useState({
    totalPools: 0,
    activePools: 0,
    totalParticipants: 0,
    totalGames: 0
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check admin status
        if (user) {
          debugLog('Checking admin status for user:', user.email);
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);
          debugLog('Super admin status:', superAdminStatus);
          
          // Both commissioners and admins can access this page
          // Commissioners will only see their own pools, admins will see all pools
          await loadPools(superAdminStatus);
          await loadStats(superAdminStatus);
          await loadCurrentWeek();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, verifyAdminStatus, router]);

  // Listen for custom event to open create pool dialog
  useEffect(() => {
    const handleOpenCreatePool = () => {
      setCreatePoolDialogOpen(true);
    };

    document.addEventListener('openCreatePoolDialog', handleOpenCreatePool);
    
    return () => {
      document.removeEventListener('openCreatePoolDialog', handleOpenCreatePool);
    };
  }, []);

  const loadPools = async (superAdminStatus: boolean) => {
    try {
      if (!user?.email) return;
      
      // Get pools based on user role
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      let poolsQuery = supabase
        .from('pools')
        .select('*')
        .order('created_at', { ascending: false });
      
      // If user is not a super admin, only show pools they created
      if (!superAdminStatus) {
        poolsQuery = poolsQuery.eq('created_by', user.email);
      }
      
      const { data: poolsData, error: poolsError } = await poolsQuery;
      
      if (poolsError) throw poolsError;
      
      // Get participant counts for each pool
      const poolsWithParticipants: PoolWithParticipants[] = await Promise.all(
        (poolsData || []).map(async (pool) => {
          const { data: participants, error: participantsError } = await supabase
            .from('participants')
            .select('id, is_active, created_at')
            .eq('pool_id', pool.id)
            .eq('is_active', true); // Only count active participants
          
          if (participantsError) throw participantsError;
          
          const participantCount = participants?.length || 0;
          const activeParticipantCount = participantCount; // Since we're already filtering for active
          
          // Get last activity (most recent participant join or pool creation)
          const lastActivity = participants && participants.length > 0 
            ? Math.max(...participants.map(p => new Date(p.created_at).getTime()), new Date(pool.created_at).getTime())
            : new Date(pool.created_at).getTime();
          
          return {
            ...pool,
            participantCount,
            activeParticipantCount,
            lastActivity: new Date(lastActivity).toLocaleDateString()
          };
        })
      );
      
      setPools(poolsWithParticipants);
      setFilteredPools(poolsWithParticipants);
      
      // Debug logging for data accuracy
      if (process.env.NODE_ENV === 'development') {
        console.log('Pools loaded:', {
          userRole: superAdminStatus ? 'admin' : 'commissioner',
          userEmail: user.email,
          totalPools: poolsWithParticipants.length,
          poolsData: poolsWithParticipants.map(p => ({
            id: p.id,
            name: p.name,
            created_by: p.created_by,
            participantCount: p.participantCount,
            activeParticipantCount: p.activeParticipantCount
          }))
        });
      }
      
    } catch (error) {
      console.error('Error loading pools:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pools data',
        variant: 'destructive',
      });
    }
  };

  const loadCurrentWeek = async () => {
    try {
      const { getUpcomingWeek } = await import('@/actions/loadCurrentWeek');
      const weekData = await getUpcomingWeek();
      setCurrentWeek(weekData?.week || 1);
    } catch (error) {
      console.error('Error loading current week:', error);
    }
  };

  const handlePoolCreated = async () => {
    // Refresh pools and stats after pool creation
    await loadPools(isSuperAdmin);
    await loadStats(isSuperAdmin);
    toast({
      title: 'Pool Created',
      description: 'New pool has been created successfully',
    });
  };

  const loadStats = async (superAdminStatus: boolean) => {
    try {
      if (!user?.email) return;
      
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      
      // Build queries based on user role
      let poolsQuery = supabase.from('pools').select('*', { count: 'exact', head: true });
      let activePoolsQuery = supabase.from('pools').select('*', { count: 'exact', head: true }).eq('is_active', true);
      
      // If user is not a super admin, only count pools they created
      if (!superAdminStatus) {
        poolsQuery = poolsQuery.eq('created_by', user.email);
        activePoolsQuery = activePoolsQuery.eq('created_by', user.email);
      }
      
      // Get total pools
      const { count: totalPools } = await poolsQuery;
      
      // Get active pools
      const { count: activePools } = await activePoolsQuery;
      
      // Get total participants for accessible pools
      let participantsQuery = supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      if (!superAdminStatus) {
        // For commissioners, get participant count only for their pools
        const { data: userPools } = await supabase
          .from('pools')
          .select('id')
          .eq('created_by', user.email);
        
        if (userPools && userPools.length > 0) {
          const poolIds = userPools.map(p => p.id);
          participantsQuery = participantsQuery.in('pool_id', poolIds);
        } else {
          // No pools created by user, so no participants
          setStats({
            totalPools: totalPools || 0,
            activePools: activePools || 0,
            totalParticipants: 0,
            totalGames: 0
          });
          return;
        }
      }
      
      const { count: totalParticipants } = await participantsQuery;
      
      // Get total games for current week (same for all users)
      const { count: totalGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true });
      
      setStats({
        totalPools: totalPools || 0,
        activePools: activePools || 0,
        totalParticipants: totalParticipants || 0,
        totalGames: totalGames || 0
      });
      
      // Debug logging for stats accuracy
      if (process.env.NODE_ENV === 'development') {
        console.log('Stats loaded:', {
          userRole: superAdminStatus ? 'admin' : 'commissioner',
          userEmail: user.email,
          totalPools,
          activePools,
          totalParticipants,
          totalGames
        });
      }
      
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredPools(pools);
    } else {
      const filtered = pools.filter(pool => 
        pool.name.toLowerCase().includes(term.toLowerCase()) ||
        pool.created_by.toLowerCase().includes(term.toLowerCase()) ||
        pool.id.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredPools(filtered);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      await signOut();
      router.push(createPageUrl('adminlogin'));
    } catch (error) {
      console.error('Error logging out:', error);
      setIsLoggingOut(false);
    }
  };

  const handleViewPool = (poolId: string) => {
    router.push(createPageUrl(`adminpool?poolId=${poolId}`));
  };

  const handleViewLeaderboard = (poolId: string) => {
    router.push(createPageUrl(`leaderboard?pool=${poolId}`));
  };

  const handleSendInvite = (pool: PoolWithParticipants) => {
    setSelectedPoolForShare(pool);
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/invite?pool=${pool.id}&week=${currentWeek}`;
    setShareLink(shareUrl);
    setShareModalOpen(true);
    setCopied(false);
  };

  const handleSharePool = (pool: PoolWithParticipants) => {
    // Navigate to the pool picks page with current week
    router.push(`/pool/${pool.id}/picks?week=${currentWeek}&seasonType=2`);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Link Copied!',
        description: 'Pool invitation link copied to clipboard',
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy link to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleTransferPool = async () => {
    if (!selectedPoolForTransfer || !newCommissionerEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please select a pool and enter the new commissioner email',
        variant: 'destructive',
      });
      return;
    }

    setIsTransferring(true);
    try {
      // Get the current session token
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const response = await fetch('/api/admin/transfer-pool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          poolId: selectedPoolForTransfer.id,
          newCommissionerEmail: newCommissionerEmail.trim()
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Pool Transferred',
          description: result.message,
        });
        setTransferPoolDialogOpen(false);
        setSelectedPoolForTransfer(null);
        setNewCommissionerEmail('');
        // Reload pools to get updated data
        await loadPools(isSuperAdmin);
        await loadStats(isSuperAdmin);
      } else {
        throw new Error(result.error || 'Failed to transfer pool');
      }
    } catch (error) {
      console.error('Transfer pool error:', error);
      toast({
        title: 'Error',
        description: 'Failed to transfer pool. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsTransferring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(createPageUrl('admindashboard'))}
                  className="p-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <h1 className="text-2xl sm:text-3xl font-bold">Pool Management</h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                {isSuperAdmin 
                  ? 'Manage all NFL Confidence Pools in the system'
                  : 'Manage your NFL Confidence Pools'
                }
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {isSuperAdmin ? 'System Admin' : 'Commissioner'}
                </Badge>
                <Button
                  onClick={handleLogout}
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-2 h-7 sm:h-8 text-xs"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Logout</span>
                  <span className="sm:hidden">Logout</span>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => {
                  const event = new CustomEvent('openCreatePoolDialog');
                  document.dispatchEvent(event);
                }}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Pool
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Pools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPools}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activePools} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalParticipants}</div>
              <p className="text-xs text-muted-foreground">
                Across all pools
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Games</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalGames}</div>
              <p className="text-xs text-muted-foreground">
                Available for pools
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalPools > 0 ? Math.round(stats.totalParticipants / stats.totalPools) : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Participants per pool
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Pools
            </CardTitle>
            <CardDescription>
              Find pools by name, creator, or pool ID
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search pools..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="max-w-md"
            />
          </CardContent>
        </Card>

        {/* Pools List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {isSuperAdmin ? 'All Pools' : 'My Pools'} ({filteredPools.length})
            </CardTitle>
            <CardDescription>
              {isSuperAdmin 
                ? 'Manage all pools, view participants, and monitor activity'
                : 'Manage your pools, view participants, and monitor activity'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredPools.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No pools found matching your search.' : 'No pools created yet.'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPools.map((pool) => (
                  <div key={pool.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <Trophy className="h-8 w-8 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {pool.name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Created by: {pool.created_by}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Badge variant={pool.is_active ? "default" : "secondary"}>
                                {pool.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge variant="outline">
                                Season {pool.season}
                              </Badge>
                              <Badge variant="outline">
                                {pool.participantCount} participants
                              </Badge>
                              {pool.tie_breaker_method && (
                                <Badge variant="outline">
                                  Tie Breaker: {pool.tie_breaker_method}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Created: {new Date(pool.created_at).toLocaleDateString()} | 
                              Last Activity: {pool.lastActivity}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => handleViewPool(pool.id)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        <Button
                          onClick={() => handleViewLeaderboard(pool.id)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <BarChart3 className="h-4 w-4" />
                          Leaderboard
                        </Button>
                        {/* Override Winners */}
                        {(isSuperAdmin || pool.created_by === user?.email) && (
                          <Button
                            onClick={() => {
                              setOverridePool(pool);
                              setOverrideSeason(String(pool.season));
                              setOverrideWeek(String(currentWeek));
                              setOverrideSeasonType('Regular');
                          // Load participants for dropdown
                          (async () => {
                            try {
                              const { getSupabaseServiceClient } = await import('@/lib/supabase');
                              const supabase = getSupabaseServiceClient();
                              const { data: participants } = await supabase
                                .from('participants')
                                .select('id, name')
                                .eq('pool_id', pool.id)
                                .eq('is_active', true)
                                .order('name', { ascending: true });
                              setOverrideParticipants((participants || []).map(p => ({ id: p.id, name: p.name || 'Unknown' })));
                            } catch (e) {
                              console.error('Failed to load participants for override', e);
                              setOverrideParticipants([]);
                            } finally {
                              setOverrideDialogOpen(true);
                            }
                          })();
                            }}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                          >
                            <Trophy className="h-4 w-4" />
                            Override Winner
                          </Button>
                        )}
                        <Button
                          onClick={() => handleSharePool(pool)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Share2 className="h-4 w-4" />
                          Share
                        </Button>
                        <Button
                          onClick={() => handleSendInvite(pool)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Mail className="h-4 w-4" />
                          Invite
                        </Button>
                        <Button
                          onClick={() => router.push(`/admin/pool/${pool.id}`)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200"
                        >
                          <Settings className="h-4 w-4" />
                          Admin
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            onClick={() => {
                              setSelectedPoolForTransfer(pool);
                              setTransferPoolDialogOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Settings className="h-4 w-4" />
                            Transfer
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pool Invitation Modal */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pool Invitation
            </DialogTitle>
            <DialogDescription>
              Invite participants to join this pool for Week {currentWeek}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="share-link" className="text-sm font-medium">
                Pool Invitation Link
              </Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="share-link"
                  value={shareLink}
                  readOnly
                  className="flex-1"
                  placeholder="Generating link..."
                />
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {selectedPoolForShare && (
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">Pool Details</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">Name:</span> {selectedPoolForShare.name}</p>
                  <p><span className="font-medium">Season:</span> {selectedPoolForShare.season}</p>
                  <p><span className="font-medium">Week:</span> {currentWeek}</p>
                  <p><span className="font-medium">Participants:</span> {selectedPoolForShare.participantCount || 0}</p>
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500">
              <p>• This link will take participants to the pool selection page for Week {currentWeek}</p>
              <p>• Participants can join the pool and submit their picks</p>
              <p>• The link includes the current week for easy access</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Override Winner Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {overrideType === 'week' ? 'Override Weekly Winner' : 'Override Quarter Winner'}
            </DialogTitle>
            <DialogDescription>
              Manually set the {overrideType === 'week' ? 'weekly' : 'quarter'} winner for a pool
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Load participants when opening */}
            {/* This is kept inside component state/effects */}
            {/* Type toggle */}
            <div className="flex gap-2">
              <Button
                variant={overrideType === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOverrideType('week')}
              >
                Weekly
              </Button>
              <Button
                variant={overrideType === 'quarter' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOverrideType('quarter')}
              >
                Quarter
              </Button>
            </div>

            {/* Pool details */}
            {overridePool && (
              <div className="text-sm text-gray-600">
                <div className="font-medium">Pool: {overridePool.name}</div>
                <div>Season: {overrideSeason || overridePool.season}</div>
              </div>
            )}

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {overrideType === 'week' ? (
                <>
                  <div>
                    <Label htmlFor="ov-week" className="text-sm">Week</Label>
                    <Input
                      id="ov-week"
                      value={overrideWeek}
                      onChange={(e) => setOverrideWeek(e.target.value)}
                      placeholder="e.g. 7"
                      min={1}
                      max={(overrideSeasonType === 'Preseason' ? MAX_WEEKS_PRESEASON : overrideSeasonType === 'Regular' ? MAX_WEEKS_REGULAR_SEASON : MAX_WEEKS_POSTSEASON)}
                      type="number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ov-seasontype" className="text-sm">Season Type</Label>
                    <select
                      id="ov-seasontype"
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={overrideSeasonType}
                      onChange={(e) => setOverrideSeasonType(e.target.value as any)}
                    >
                      <option value="Preseason">Preseason</option>
                      <option value="Regular">Regular</option>
                      <option value="Postseason">Postseason</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <Label htmlFor="ov-quarter" className="text-sm">Quarter</Label>
                    <select
                      id="ov-quarter"
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={overrideQuarter}
                      onChange={(e) => setOverrideQuarter(e.target.value as any)}
                    >
                      <option value="Q1">Q1 (Weeks 1-4)</option>
                      <option value="Q2">Q2 (Weeks 5-8)</option>
                      <option value="Q3">Q3 (Weeks 9-12)</option>
                      <option value="Q4">Q4 (Weeks 13-16)</option>
                      <option value="Playoffs">Playoffs</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="ov-season" className="text-sm">Season</Label>
                <Input id="ov-season" value={overrideSeason} onChange={(e) => setOverrideSeason(e.target.value)} placeholder="e.g. 2025" />
              </div>
              <div>
                <Label htmlFor="ov-participant" className="text-sm">Winner Participant</Label>
                <select
                  id="ov-participant"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={overrideParticipantId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setOverrideParticipantId(pid);
                    const p = overrideParticipants.find(x => x.id === pid);
                    setOverrideParticipantName(p?.name || '');
                  }}
                >
                  <option value="">Select participant…</option>
                  {overrideParticipants.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="ov-participant-name" className="text-sm">Winner Name</Label>
                <Input id="ov-participant-name" value={overrideParticipantName} onChange={(e) => setOverrideParticipantName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <Label htmlFor="ov-points" className="text-sm">Points (optional)</Label>
                <Input id="ov-points" value={overridePoints} onChange={(e) => setOverridePoints(e.target.value)} placeholder="leave blank to use current" />
              </div>
              <div>
                <Label htmlFor="ov-correct" className="text-sm">Correct Picks (optional)</Label>
                <Input id="ov-correct" value={overrideCorrect} onChange={(e) => setOverrideCorrect(e.target.value)} placeholder="leave blank to use current" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={async () => {
                  if (!overridePool) return;
                  setIsSubmittingOverride(true);
                  try {
                  if (!overrideParticipantName.trim()) {
                      toast({ title: 'Missing fields', description: 'Winner name is required', variant: 'destructive' });
                      setIsSubmittingOverride(false);
                      return;
                    }
                    const { getSupabaseClient } = await import('@/lib/supabase');
                    const supabase = getSupabaseClient();
                    const { data: { session } } = await supabase.auth.getSession();

                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

                    if (overrideType === 'week') {
                      // Derive season type number from label
                      const seasonTypeNum = overrideSeasonType === 'Preseason' ? 1 : overrideSeasonType === 'Regular' ? 2 : 3;
                      // If points/correct not provided, fetch from leaderboard
                      let pointsToUse = overridePoints.trim();
                      let correctToUse = overrideCorrect.trim();
                      if (!pointsToUse || !correctToUse) {
                        const lbRes = await fetch(`/api/leaderboard?poolId=${overridePool.id}&week=${Number(overrideWeek)}&seasonType=${seasonTypeNum}&season=${Number(overrideSeason || overridePool.season)}`);
                        if (lbRes.ok) {
                          const lb = await lbRes.json();
                          const entry = (lb.leaderboard || []).find((e: any) => e.participant_id === overrideParticipantId || e.participant_name === overrideParticipantName);
                          if (entry) {
                            if (!pointsToUse) pointsToUse = String(entry.total_points || 0);
                            if (!correctToUse) correctToUse = String(entry.correct_picks || 0);
                          }
                        }
                      }
                      const res = await fetch('/api/admin/week-winner', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                          poolId: overridePool.id,
                          week: Number(overrideWeek),
                          season: Number(overrideSeason || overridePool.season),
                          seasonType: seasonTypeNum,
                          winnerParticipantId: overrideParticipantId || null,
                          winnerName: overrideParticipantName.trim(),
                          winnerPoints: Number(pointsToUse || 0),
                          winnerCorrectPicks: Number(correctToUse || 0),
                          totalParticipants: overridePool.participantCount || 0
                        })
                      });
                      if (!res.ok) throw new Error('Failed to save weekly winner');
                      toast({ title: 'Weekly winner saved', description: `Week ${overrideWeek} winner overridden.` });
                    } else {
                      // For quarter override, if points/correct missing, derive from periods leaderboard
                      let pointsToUse = overridePoints.trim();
                      let correctToUse = overrideCorrect.trim();
                      if (!pointsToUse || !correctToUse) {
                        const periodNameMap: Record<string, string> = { Q1: 'Period 1', Q2: 'Period 2', Q3: 'Period 3', Q4: 'Period 4', Playoffs: 'Playoffs' };
                        const plRes = await fetch(`/api/periods/leaderboard?poolId=${overridePool.id}&season=${Number(overrideSeason || overridePool.season)}&periodName=${encodeURIComponent(periodNameMap[overrideQuarter])}`);
                        if (plRes.ok) {
                          const data = await plRes.json();
                          const leaderboard = data?.data?.leaderboard || [];
                          const entry = leaderboard.find((e: any) => e.participant_id === overrideParticipantId || e.name === overrideParticipantName);
                          if (entry) {
                            if (!pointsToUse) pointsToUse = String(entry.total_points || 0);
                            if (!correctToUse) correctToUse = String(entry.total_correct || 0);
                          }
                        }
                      }
                      const res = await fetch('/api/admin/period-winner', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                          poolId: overridePool.id,
                          season: Number(overrideSeason || overridePool.season),
                          periodName: overrideQuarter,
                          winnerParticipantId: overrideParticipantId || null,
                          winnerName: overrideParticipantName.trim(),
                          periodPoints: Number(pointsToUse || 0),
                          periodCorrectPicks: Number(correctToUse || 0),
                          totalParticipants: overridePool.participantCount || 0
                        })
                      });
                      if (!res.ok) throw new Error('Failed to save period winner');
                      toast({ title: 'Quarter winner saved', description: `${overrideQuarter} winner overridden.` });
                    }

                    setOverrideDialogOpen(false);
                    setOverrideParticipantId('');
                    setOverrideParticipantName('');
                    setOverridePoints('');
                    setOverrideCorrect('');
                  } catch (e) {
                    console.error(e);
                    toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
                  } finally {
                    setIsSubmittingOverride(false);
                  }
                }}
                disabled={isSubmittingOverride}
              >
                {isSubmittingOverride ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setOverrideDialogOpen(false)} disabled={isSubmittingOverride}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Pool Dialog */}
      <CreatePoolDialog 
        open={createPoolDialogOpen} 
        onOpenChange={setCreatePoolDialogOpen}
        onPoolCreated={handlePoolCreated}
      />

      {/* Transfer Pool Dialog */}
      <Dialog open={transferPoolDialogOpen} onOpenChange={setTransferPoolDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Transfer Pool
            </DialogTitle>
            <DialogDescription>
              Transfer pool ownership to another commissioner
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedPoolForTransfer && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2 text-blue-900">Pool Details</h4>
                <div className="space-y-1 text-sm text-blue-800">
                  <p><span className="font-medium">Name:</span> {selectedPoolForTransfer.name}</p>
                  <p><span className="font-medium">Current Owner:</span> {selectedPoolForTransfer.created_by}</p>
                  <p><span className="font-medium">Participants:</span> {selectedPoolForTransfer.participantCount || 0}</p>
                </div>
              </div>
            )}
            
            <div>
              <Label htmlFor="new-commissioner" className="text-sm font-medium">
                New Commissioner Email
              </Label>
              <Input
                id="new-commissioner"
                type="email"
                value={newCommissionerEmail}
                onChange={(e) => setNewCommissionerEmail(e.target.value)}
                placeholder="commissioner@example.com"
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter the email address of the commissioner who will receive this pool
              </p>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <h4 className="font-medium text-sm mb-2 text-yellow-900">⚠️ Important</h4>
              <div className="text-sm text-yellow-800 space-y-1">
                <p>• This action will transfer complete ownership of the pool</p>
                <p>• The new commissioner will have full control over the pool</p>
                <p>• This action cannot be undone</p>
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleTransferPool}
                disabled={isTransferring || !newCommissionerEmail.trim()}
                className="flex items-center gap-2"
              >
                {isTransferring ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Transferring...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4" />
                    Transfer Pool
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setTransferPoolDialogOpen(false);
                  setSelectedPoolForTransfer(null);
                  setNewCommissionerEmail('');
                }}
                disabled={isTransferring}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PoolsManagementPage() {
  return (
    <AuthProvider>
      <SharedAdminGuard>
        <PoolsManagementContent />
      </SharedAdminGuard>
    </AuthProvider>
  );
}
