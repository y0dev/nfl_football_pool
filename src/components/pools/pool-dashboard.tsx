'use client';

import { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreatePoolDialog } from '@/components/pools/CreatePoolDialog';
import { JoinPoolButton } from '@/components/pools/JoinPoolButton';
import loadPoolsAction from '@/actions/loadPools';
import { useAuth } from '@/lib/auth.tsx';
import { Users, Trophy, Calendar, DollarSign, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface Pool {
  id: number;
  name: string;
  description: string;
  creator_name: string;
  season_year: number;
  participant_count: number;
  entry_fee: number;
  max_participants: number | null;
  join_deadline: string | null;
  is_public: boolean;
  created_at: string;
}

export function PoolDashboard() {
  const [pools, loading, error, refresh] = useLoadAction(loadPoolsAction, []);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { user } = useAuth();

  const poolsData: Pool[] = pools || [];

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
        <Button onClick={refresh} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Confidence Pools</h2>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Pool
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Pools</TabsTrigger>
          <TabsTrigger value="my-pools">My Pools</TabsTrigger>
          <TabsTrigger value="available">Available to Join</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <PoolGrid pools={poolsData} onPoolJoined={refresh} />
        </TabsContent>

        <TabsContent value="my-pools" className="mt-6">
          <PoolGrid 
            pools={poolsData.filter(pool => pool.creator_name === user?.display_name)} 
            onPoolJoined={refresh}
            showJoinButton={false}
          />
        </TabsContent>

        <TabsContent value="available" className="mt-6">
          <PoolGrid 
            pools={poolsData.filter(pool => pool.is_public && pool.creator_name !== user?.display_name)} 
            onPoolJoined={refresh}
          />
        </TabsContent>
      </Tabs>

      <CreatePoolDialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        onPoolCreated={refresh}
      />
    </div>
  );
}

interface PoolGridProps {
  pools: Pool[];
  onPoolJoined: () => void;
  showJoinButton?: boolean;
}

function PoolGrid({ pools, onPoolJoined, showJoinButton = true }: PoolGridProps) {
  if (pools.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No pools found</h3>
        <p className="text-gray-600">There are no pools matching your criteria yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {pools.map((pool) => (
        <Card key={pool.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">{pool.name}</CardTitle>
                <CardDescription>Created by {pool.creator_name}</CardDescription>
              </div>
              <Badge variant="secondary">{pool.season_year} Season</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {pool.description && (
              <p className="text-sm text-gray-600">{pool.description}</p>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span>
                  {pool.participant_count}
                  {pool.max_participants ? `/${pool.max_participants}` : ''} players
                </span>
              </div>
              
              {pool.entry_fee > 0 && (
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  <span>${pool.entry_fee}</span>
                </div>
              )}
              
              {pool.join_deadline && (
                <div className="flex items-center space-x-2 col-span-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>Join by {format(new Date(pool.join_deadline), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>

            {showJoinButton && (
              <JoinPoolButton 
                poolId={pool.id} 
                poolName={pool.name}
                onJoined={onPoolJoined}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
