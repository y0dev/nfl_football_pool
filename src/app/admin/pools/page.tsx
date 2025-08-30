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
import { debugLog, createPageUrl } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
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
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedPoolForShare, setSelectedPoolForShare] = useState<PoolWithParticipants | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [createPoolDialogOpen, setCreatePoolDialogOpen] = useState(false);
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
    router.push(createPageUrl(`adminleaderboard?pool=${poolId}`));
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

      {/* Create Pool Dialog */}
      <CreatePoolDialog 
        open={createPoolDialogOpen} 
        onOpenChange={setCreatePoolDialogOpen}
        onPoolCreated={handlePoolCreated}
      />
    </div>
  );
}

export default function PoolsManagementPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <PoolsManagementContent />
      </AdminGuard>
    </AuthProvider>
  );
}
