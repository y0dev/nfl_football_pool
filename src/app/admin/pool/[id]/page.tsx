'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Users, 
  Trophy, 
  Settings, 
  BarChart3, 
  Calendar,
  Activity,
  Clock,
  TrendingUp,
  Shield
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminService } from '@/lib/admin-service';
import { debugLog, createPageUrl } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { ExportData } from '@/components/admin/export-data';
import { PoolSettings } from '@/components/admin/pool-settings';
import { ParticipantManagement } from '@/components/admin/participant-management';
import { TieBreakerSettings } from '@/components/admin/tie-breaker-settings';
import { OverrideMondayNightScore } from '@/components/admin/override-monday-night-score';

function PoolAdminContent() {
  const params = useParams();
  const poolId = params.id as string;
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [pool, setPool] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeason, setCurrentSeason] = useState(new Date().getFullYear());

  useEffect(() => {
    if (poolId) {
      loadPoolData();
    }
  }, [poolId]);

  const loadPoolData = async () => {
    try {
      setIsLoading(true);
      
      // Load pool information
      const poolData = await adminService.getPoolById(poolId);
      setPool(poolData);
      
      // Load participants
      const participantsData = await adminService.getPoolParticipants(poolId);
      setParticipants(participantsData);
      
      // Get current week (you might want to get this from your current week logic)
      setCurrentWeek(1); // This should be dynamic based on your current week logic
      
    } catch (error) {
      console.error('Error loading pool data:', error);
      toast({
        title: "Error",
        description: "Failed to load pool data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    router.push(createPageUrl('admin/dashboard'));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading pool data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Pool Not Found</h2>
              <p className="text-gray-600 mb-4">The requested pool could not be found.</p>
              <Button onClick={handleBackToDashboard} className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'participants', label: 'Participants', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'export', label: 'Export Data', icon: Activity },
    { id: 'tiebreakers', label: 'Tie Breakers', icon: Trophy },
    { id: 'mondaynight', label: 'Monday Night', icon: Clock }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Button
                  onClick={handleBackToDashboard}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <h1 className="text-2xl sm:text-3xl font-bold">{pool.name}</h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Pool administration and management
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  Pool Admin
                </Badge>
                <Badge variant={pool.is_active ? "default" : "secondary"} className="text-xs">
                  {pool.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {participants.length} Participants
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "ghost"}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Participants</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{participants.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Active participants
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Pool Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold capitalize">
                    {pool.pool_type || 'Normal'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Competition style
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">
                    {pool.is_active ? 'Active' : 'Inactive'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pool status
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Current Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentWeek}</div>
                  <p className="text-xs text-muted-foreground">
                    Week {currentWeek} of season
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Season</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentSeason}</div>
                  <p className="text-xs text-muted-foreground">
                    Current season
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Created</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold">
                    {new Date(pool.created_at).toLocaleDateString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pool creation date
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'participants' && (
            <ParticipantManagement poolId={poolId} poolName={pool.name} />
          )}

          {activeTab === 'settings' && (
            <PoolSettings poolId={poolId} poolName={pool.name} />
          )}

          {activeTab === 'export' && (
            <ExportData 
              poolId={poolId}
              poolName={pool.name}
              currentWeek={currentWeek}
              currentSeason={currentSeason}
            />
          )}

          {activeTab === 'tiebreakers' && (
            <TieBreakerSettings poolId={poolId} poolName={pool.name} />
          )}

          {activeTab === 'mondaynight' && (
            <OverrideMondayNightScore 
              poolId={poolId}
              poolName={pool.name}
              week={currentWeek}
              season={currentSeason}
              seasonType={2}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function PoolAdminPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <PoolAdminContent />
      </AdminGuard>
    </AuthProvider>
  );
}
