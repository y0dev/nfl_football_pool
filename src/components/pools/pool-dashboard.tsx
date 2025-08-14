'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreatePoolDialog } from '@/components/pools/create-pool-dialog';
import { JoinPoolButton } from '@/components/pools/join-pool-button';
import { SharePoolButton } from '@/components/pools/share-pool-button';
import { loadPools } from '@/actions/loadPools';
import { useAuth } from '@/lib/auth';
import { Users, Trophy, Calendar, Plus, Settings, Shield, Edit3, AlertCircle, Unlock } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { format } from 'date-fns';

interface Pool {
  id: string;
  name: string;
  description: string;
  created_by: string;
  season: number;
  is_active: boolean;
  created_at: string;
}

interface PoolDashboardProps {
  hideCreateButton?: boolean;
}

export function PoolDashboard({ hideCreateButton = false }: PoolDashboardProps) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [adminOverrideOpen, setAdminOverrideOpen] = useState(false);
  const [selectedPoolForOverride, setSelectedPoolForOverride] = useState<Pool | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [isOverridingPicks, setIsOverridingPicks] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (user === null) {
      router.push('/admin/login');
    }
  }, [user, router]);

  async function fetchPools() {
    try {
      setLoading(true);
      setError(null);
      const poolsData = await loadPools(
        user?.email, 
        user?.is_super_admin
      );
      
      setPools(poolsData);
    } catch (err) {
      setError('Failed to load pools');
      console.error('Error loading pools:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPools();
  }, [user]);

  // Listen for custom event to open create pool dialog
  useEffect(() => {
    const handleOpenCreatePool = () => {
      setCreateDialogOpen(true);
    };

    document.addEventListener('openCreatePoolDialog', handleOpenCreatePool);
    
    return () => {
      document.removeEventListener('openCreatePoolDialog', handleOpenCreatePool);
    };
  }, []);

  const overridePoolPicks = async () => {
    if (!selectedPoolForOverride || !user) {
      toast({
        title: "Error",
        description: "No pool selected for override",
        variant: "destructive",
      });
      return;
    }

    if (!overrideReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for overriding picks",
        variant: "destructive",
      });
      return;
    }

    // Check if user has permission to override this pool
    if (!user.is_super_admin && selectedPoolForOverride.created_by !== user.email) {
      toast({
        title: "Permission Denied",
        description: "You can only override picks in pools you created",
        variant: "destructive",
      });
      return;
    }

    setIsOverridingPicks(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      // Get current week and season type
      const { data: currentWeek } = await supabase
        .from('games')
        .select('week, season_type')
        .order('week', { ascending: false })
        .limit(1)
        .single();

      if (!currentWeek) {
        throw new Error('No current week found');
      }

      // Get game IDs for the current week
      const { data: gameIds } = await supabase
        .from('games')
        .select('id')
        .eq('week', currentWeek.week)
        .eq('season_type', currentWeek.season_type);

      if (!gameIds || gameIds.length === 0) {
        throw new Error('No games found for current week');
      }

      // Delete all picks for this pool for the current week
      const { error } = await supabase
        .from('picks')
        .delete()
        .eq('pool_id', selectedPoolForOverride.id)
        .in('game_id', gameIds.map(g => g.id));
      
      if (error) {
        throw error;
      }

      // Log the override action
      await supabase
        .from('audit_logs')
        .insert({
          action: 'override_pool_picks',
          admin_id: user.id,
          pool_id: selectedPoolForOverride.id,
          details: JSON.stringify({ 
            pool_name: selectedPoolForOverride.name,
            week: currentWeek.week, 
            season_type: currentWeek.season_type,
            override_reason: overrideReason,
            overridden_by: user.is_super_admin ? 'super_admin' : 'pool_admin',
            overridden_at: new Date().toISOString()
          }),
          created_at: new Date().toISOString()
        });

      toast({
        title: "Picks Overridden",
        description: `All picks for ${selectedPoolForOverride.name} have been overridden. Reason: ${overrideReason}`,
      });

      // Reset state
      setOverrideReason('');
      setSelectedPoolForOverride(null);
      setAdminOverrideOpen(false);

    } catch (error) {
      console.error('Error overriding pool picks:', error);
      toast({
        title: "Error",
        description: "Failed to override picks",
        variant: "destructive",
      });
    } finally {
      setIsOverridingPicks(false);
    }
  };

  // Don't render anything if user is not authenticated
  if (user === null) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold">Confidence Pools</h2>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Create Pool
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-100 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-100 rounded"></div>
                  <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load pools</h3>
        <p className="text-gray-600 mb-4">There was an error loading the confidence pools.</p>
        <Button onClick={fetchPools} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Confidence Pools</h2>
        {!hideCreateButton && (
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            data-create-pool
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Pool
          </Button>
        )}
      </div>

      {/* For normal admins, show simple list */}
      {!user?.is_super_admin ? (
        <PoolGrid 
          pools={pools} 
          onPoolJoined={fetchPools} 
          user={user}
          onOverridePicks={(pool) => {
            setSelectedPoolForOverride(pool);
            setAdminOverrideOpen(true);
          }}
        />
      ) : (
        /* For super admins, show tabs */
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Pools</TabsTrigger>
            {user?.is_super_admin && (
              <TabsTrigger value="my-pools">My Pools</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <PoolGrid 
              pools={pools} 
              onPoolJoined={fetchPools} 
              user={user}
              onOverridePicks={(pool) => {
                setSelectedPoolForOverride(pool);
                setAdminOverrideOpen(true);
              }}
            />
          </TabsContent>

          {user?.is_super_admin && (
            <TabsContent value="my-pools" className="mt-6">
              <PoolGrid 
                pools={pools.filter(pool => pool.created_by === user?.email)} 
                onPoolJoined={fetchPools}
                showJoinButton={true} // Allow joining own pools
                user={user}
                onOverridePicks={(pool) => {
                  setSelectedPoolForOverride(pool);
                  setAdminOverrideOpen(true);
                }}
              />
            </TabsContent>
          )}
        </Tabs>
      )}

      <CreatePoolDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        onPoolCreated={fetchPools}
      />

      {/* Admin Override Dialog */}
      <AlertDialog open={adminOverrideOpen} onOpenChange={setAdminOverrideOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl text-red-600">
              Override Pool Picks
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              This will permanently delete all picks for <strong>{selectedPoolForOverride?.name}</strong> for the current week.
              <br /><br />
              This action should only be used in exceptional circumstances (e.g., technical issues, rule violations, or pool-wide problems).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="override-reason" className="text-sm font-medium">Reason for Override *</Label>
              <textarea
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why you are overriding all picks for this pool..."
                className="w-full p-3 border border-orange-300 rounded-lg bg-white text-sm resize-none mt-2"
                rows={3}
                maxLength={500}
              />
              <div className="text-xs text-orange-600 mt-1">
                {overrideReason.length}/500 characters
              </div>
            </div>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium mb-1">Warning: This action will affect ALL participants in this pool.</p>
                  <p>All picks for the current week will be permanently deleted and participants will need to resubmit.</p>
                </div>
              </div>
            </div>
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={overridePoolPicks}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
              disabled={isOverridingPicks || !overrideReason.trim()}
            >
              {isOverridingPicks ? 'Overriding...' : 'Override All Picks'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface PoolGridProps {
  pools: Pool[];
  onPoolJoined: () => void;
  showJoinButton?: boolean;
  user?: { email: string; is_super_admin?: boolean } | null;
  onOverridePicks?: (pool: Pool) => void;
}

function PoolGrid({ pools, onPoolJoined, showJoinButton = true, user, onOverridePicks }: PoolGridProps) {
  
  if (pools.length === 0) {
    console.log('PoolGrid: No pools to display');
    return (
      <div className="text-center py-12">
        <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No pools found</h3>
        <p className="text-gray-600">No confidence pools match your criteria.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {pools.map((pool) => (
        <Card key={pool.id} className="hover:shadow-lg transition-shadow flex flex-col">
          <CardHeader className="flex-shrink-0">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl truncate">{pool.name}</CardTitle>
                <CardDescription className="mt-1 truncate">
                  Created by {pool.created_by}
                </CardDescription>
              </div>
              <Badge variant={pool.is_active ? "default" : "secondary"} className="flex-shrink-0">
                {pool.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col">
            <p className="text-gray-600 text-sm flex-shrink-0">
              {pool.description || "No description provided"}
            </p>
            
            <div className="flex items-center justify-between text-sm text-gray-500 flex-shrink-0">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>Season {pool.season}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>Members</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-auto">
              <SharePoolButton 
                poolId={pool.id} 
                poolName={pool.name}
              />
              <Link href={`/admin/pool/${pool.id}`}>
                <Button variant="outline" size="sm" className="flex items-center gap-2 min-w-0">
                  <Settings className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Details</span>
                  <span className="sm:hidden">Details</span>
                </Button>
              </Link>
              {showJoinButton && (
                <JoinPoolButton 
                  poolId={pool.id} 
                  onJoined={onPoolJoined}
                />
              )}
              {/* Admin Override Button - only show for pool admins or super admins */}
              {(user?.is_super_admin || pool.created_by === user?.email) && onOverridePicks && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOverridePicks(pool)}
                  className="flex items-center gap-2 min-w-0 border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <Shield className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Override</span>
                  <span className="sm:hidden">Override</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
