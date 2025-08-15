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

            />
          </TabsContent>

          {user?.is_super_admin && (
            <TabsContent value="my-pools" className="mt-6">
              <PoolGrid 
                pools={pools.filter(pool => pool.created_by === user?.email)} 
                onPoolJoined={fetchPools}
                showJoinButton={true} // Allow joining own pools
                user={user}

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


    </div>
  );
}

interface PoolGridProps {
  pools: Pool[];
  onPoolJoined: () => void;
  showJoinButton?: boolean;
  user?: { email: string; is_super_admin?: boolean } | null;
}

function PoolGrid({ pools, onPoolJoined, showJoinButton = true, user }: PoolGridProps) {
  
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
              {(user?.is_super_admin || pool.created_by === user?.email) && (
                <Link href={`/admin/override-picks?pool=${pool.id}`}>
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
