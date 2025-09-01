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
import { useAuth } from '@/lib/auth';
import { adminService } from '@/lib/admin-service';
import { Users, Trophy, Calendar, Plus, Settings, Shield, Edit3, AlertCircle, Unlock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_POOL_SEASON, createPageUrl } from '@/lib/utils';

// import { format } from 'date-fns';

interface Pool {
  id: string;
  name: string;
  description: string;
  created_by: string;
  season: number;
  is_active: boolean;
  created_at: string;
  participant_count?: number;
}

interface PoolDashboardProps {
  hideCreateButton?: boolean;
}

export function PoolDashboard({ hideCreateButton = false }: PoolDashboardProps) {
  const { user, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const [pools, setPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const { toast } = useToast();

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (user === null) {
      router.push('/admin/login');
    }
  }, [user, router]);

  const loadPools = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Check admin status
      const superAdminStatus = await verifyAdminStatus(true);
      setIsSuperAdmin(superAdminStatus);
      
      // Use the correct AdminService function
      const poolsData = await adminService.getActivePools(
        user.email,
        superAdminStatus
      );
      if (process.env.NODE_ENV === 'development') {
        console.log('PoolDashboard: Pools data:', poolsData);
      }
      
      // Transform the data to match the Pool interface
      const transformedPools = poolsData.map(pool => ({
        id: pool.id,
        name: pool.name,
        description: '',
        created_by: '',
        season: pool.season || DEFAULT_POOL_SEASON,
        is_active: true,
        created_at: new Date().toISOString(),
        participant_count: 0
      }));
      if (process.env.NODE_ENV === 'development') {
        console.log('PoolDashboard: Transformed pools:', transformedPools);
      }
      setPools(transformedPools);
    } catch (error) {
      setError('Failed to load pools');
      console.error('Error loading pools:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPools();
  }, [user, verifyAdminStatus]);

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





  // Don't render anything if user is not authenticated
  if (user === null) {
    return null;
  }

  if (isLoading) {
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
        <Button onClick={loadPools} variant="outline">
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
      {!isSuperAdmin ? (
        <PoolGrid 
          pools={pools} 
          onPoolJoined={loadPools} 
          user={{ email: user.email, isSuperAdmin }}
        />
      ) : (
        /* For admins, show tabs */
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Pools</TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="my-pools">My Pools</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <PoolGrid 
              pools={pools} 
              onPoolJoined={loadPools} 
              user={{ email: user.email, isSuperAdmin }}
            />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="my-pools" className="mt-6">
              <PoolGrid 
                pools={pools.filter(pool => pool.created_by === user?.email)} 
                onPoolJoined={loadPools}
                showJoinButton={true} // Allow joining own pools
                user={{ email: user.email, isSuperAdmin }}
              />
            </TabsContent>
          )}
        </Tabs>
      )}

      <CreatePoolDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        onPoolCreated={loadPools}
      />


    </div>
  );
}

interface PoolGridProps {
  pools: Pool[];
  onPoolJoined: () => void;
  showJoinButton?: boolean;
  user?: { email: string; isSuperAdmin?: boolean } | null;
}

function PoolGrid({ pools, onPoolJoined, showJoinButton = true, user }: PoolGridProps) {
  if (process.env.NODE_ENV === 'development') {
    console.log('PoolGrid: User:', user);
    console.log('PoolGrid: Show Join Button:', showJoinButton);
    console.log('PoolGrid: Pools:', pools);
  }
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
              {/* Commissioner Override Button - only show for pool commissioners or admins */}
              {(user?.isSuperAdmin || pool.created_by === user?.email) && (
                <Link href={createPageUrl(`overridepicks?poolId=${pool.id}`)}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 min-w-0 border-orange-300 text-orange-700 hover:bg-orange-50"
                  >
                    <Shield className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden sm:inline">Override</span>
                    <span className="sm:hidden">Override</span>
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
