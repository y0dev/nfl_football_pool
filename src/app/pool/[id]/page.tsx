'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Edit, Save, X, Users, Trophy, Calendar, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SharePoolButton } from '@/components/pools/share-pool-button';
import { ParticipantManagement } from '@/components/admin/participant-management';
import { EnhancedEmailManagement } from '@/components/admin/enhanced-email-management';
import { TestPicks } from '@/components/admin/test-picks';
import { ParticipantLinks } from '@/components/admin/participant-links';
import { PoolSettings } from '@/components/admin/pool-settings';

import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { DEFAULT_POOL_SEASON, DEFAULT_WEEK, DEFAULT_SEASON_TYPE, createPageUrl, PERIOD_WEEKS } from '@/lib/utils';

interface Pool {
  id: string;
  name: string;
  created_by: string;
  season: number;
  is_active: boolean;
  created_at: string;
  description?: string;
  pool_type?: 'normal' | 'knockout';
  tie_breaker_method?: string;
  tie_breaker_question?: string;
  tie_breaker_answer?: number;
}

function PoolDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const poolId = params.id as string;
  
  const [pool, setPool] = useState<Pool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(DEFAULT_WEEK);
  const [currentSeasonType, setCurrentSeasonType] = useState(DEFAULT_SEASON_TYPE); // Default to regular season
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Form state for editing
  const [editForm, setEditForm] = useState({
    name: '',
    season: DEFAULT_POOL_SEASON,
    is_active: true,
    description: '',
    pool_type: 'normal' as 'normal' | 'knockout',
    tie_breaker_method: '',
    tie_breaker_question: '',
    tie_breaker_answer: 0
  });

  useEffect(() => {
    loadPoolData();
    loadCurrentWeekData();
  }, [poolId]); // eslint-disable-line react-hooks/exhaustive-deps


  const loadPoolData = async () => {
    try {
      setIsLoading(true);
      // Fetch pool details - you'll need to create this action
      const response = await fetch(`/api/admin/pools/${poolId}`);
      const result = await response.json();
      
      if (result.success) {
        setPool(result.pool);
        setEditForm({
          name: result.pool.name,
          season: result.pool.season,
          is_active: result.pool.is_active,
          description: result.pool.description || '',
          pool_type: result.pool.pool_type || 'normal',
          tie_breaker_method: result.pool.tie_breaker_method || '',
          tie_breaker_question: result.pool.tie_breaker_question || '',
          tie_breaker_answer: result.pool.tie_breaker_answer || 0
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to load pool details",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading pool:', error);
      toast({
        title: "Error",
        description: "Failed to load pool details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCurrentWeekData = async () => {
    try {
      const weekData = await loadCurrentWeek();
      setCurrentWeek(weekData?.week_number || 1);
      setCurrentSeasonType(weekData?.season_type || DEFAULT_SEASON_TYPE); // Default to regular season
    } catch (error) {
      console.error('Error loading current week:', error);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Validate form data
      if (!editForm.name.trim()) {
        toast({
          title: "Error",
          description: "Pool name is required",
          variant: "destructive",
        });
        return;
      }
      
      if (editForm.season < 2020 || editForm.season > 2030) {
        toast({
          title: "Error",
          description: "Season must be between 2020 and 2030",
          variant: "destructive",
        });
        return;
      }
      
      // Debug: Log what we're trying to save
      console.log('Saving pool data:', editForm);
      
      const response = await fetch(`/api/admin/pools/${poolId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      const result = await response.json();
      console.log('Save response:', result);

      if (result.success) {
        toast({
          title: "Success",
          description: "Pool updated successfully",
        });
        setPool(result.pool);
        setIsEditing(false);
        
        // Refresh the pool data to show updated values
        await loadPoolData();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update pool",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating pool:', error);
      toast({
        title: "Error",
        description: "Failed to update pool",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };


  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Pool not found</h3>
          <p className="text-gray-600 mb-4">The pool you&apos;re looking for doesn&apos;t exist.</p>
                  <Button onClick={() => router.push(createPageUrl('adminpools'))} variant="outline">
          Back to Pools
        </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        {/* Back Button */}
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(createPageUrl('adminpools'))}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Pools</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>

        {/* Pool Title and Actions */}
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{pool.name}</h1>
            <p className="text-gray-600 text-sm sm:text-base">Pool Management</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SharePoolButton poolId={pool.id} poolName={pool.name} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2 min-w-0"
            >
              {isEditing ? <X className="h-4 w-4 flex-shrink-0" /> : <Edit className="h-4 w-4 flex-shrink-0" />}
              <span className="hidden sm:inline">{isEditing ? 'Cancel' : 'Edit'}</span>
            </Button>
            {isEditing && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 min-w-0"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="hidden sm:inline">Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden sm:inline">Save</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Pool Status */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
          <Badge variant={pool.is_active ? "default" : "secondary"}>
            {pool.is_active ? "Active" : "Inactive"}
          </Badge>
          <div className="flex items-center gap-1 sm:gap-2 text-gray-600">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Season {pool.season}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 text-gray-600">
            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Created by {pool.created_by}</span>
            <span className="sm:hidden">By {pool.created_by}</span>
          </div>
        </div>
      </div>

      {/* Pool Details Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Pool Details
          </CardTitle>
          <CardDescription>
            {isEditing ? 'Edit pool information' : 'View pool information'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Pool Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                disabled={!isEditing}
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="season">Season</Label>
              <Input
                id="season"
                type="number"
                value={editForm.season}
                onChange={(e) => setEditForm({ ...editForm, season: parseInt(e.target.value) })}
                disabled={!isEditing}
                className="w-full"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              disabled={!isEditing}
              rows={3}
              className="w-full resize-none"
              placeholder="Enter pool description..."
            />
          </div>

          <div>
            <Label htmlFor="pool_type">Pool Type</Label>
            <Select
              value={editForm.pool_type}
              onValueChange={(value: 'normal' | 'knockout') => setEditForm({ ...editForm, pool_type: value })}
              disabled={!isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pool type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal Pool</SelectItem>
                <SelectItem value="knockout">Knockout Pool</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600 mt-1">
              Normal pools disable tie breakers during regular weeks (tie breakers only used in tie-breaker weeks {PERIOD_WEEKS.join(', ')}, and Super Bowl in playoffs). 
              Knockout pools always use tie breakers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="tie_breaker_method">Tie Breaker Method</Label>
              <Select
                value={editForm.tie_breaker_method}
                onValueChange={(value) => setEditForm({ ...editForm, tie_breaker_method: value })}
                disabled={!isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tie breaker method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total_points">Total Points</SelectItem>
                  <SelectItem value="correct_picks">Correct Picks</SelectItem>
                  <SelectItem value="confidence_points">Confidence Points</SelectItem>
                  <SelectItem value="monday_night_total">Monday Night Total</SelectItem>
                  <SelectItem value="highest_scoring_game">Highest Scoring Game</SelectItem>
                  <SelectItem value="lowest_scoring_game">Lowest Scoring Game</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tie_breaker_question">Tie Breaker Question</Label>
              <Input
                id="tie_breaker_question"
                value={editForm.tie_breaker_question}
                onChange={(e) => setEditForm({ ...editForm, tie_breaker_question: e.target.value })}
                disabled={!isEditing}
                placeholder={
                  editForm.tie_breaker_method === 'monday_night_total' 
                    ? "e.g., What will be the total points scored in Monday night's game?"
                    : editForm.tie_breaker_method === 'highest_scoring_game'
                    ? "e.g., What will be the total points in the highest scoring game?"
                    : editForm.tie_breaker_method === 'lowest_scoring_game'
                    ? "e.g., What will be the total points in the lowest scoring game?"
                    : editForm.tie_breaker_method === 'custom'
                    ? "Enter your custom tie breaker question"
                    : "e.g., Enter tie breaker question"
                }
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="tie_breaker_answer">Tie Breaker Answer</Label>
              <Input
                id="tie_breaker_answer"
                type="number"
                value={editForm.tie_breaker_answer}
                onChange={(e) => setEditForm({ ...editForm, tie_breaker_answer: parseInt(e.target.value) })}
                disabled={!isEditing}
                placeholder="0"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={editForm.is_active}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
              disabled={!isEditing}
              className="rounded"
            />
            <Label htmlFor="is_active">Pool is active</Label>
          </div>
        </CardContent>
      </Card>

      {/* Pool Management Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <TabsList className="flex w-full min-w-max gap-1 p-1">
            <TabsTrigger value="overview" className="text-xs whitespace-nowrap px-2 py-1">Overview</TabsTrigger>
            {process.env.NODE_ENV === 'development' && (
              <TabsTrigger value="test-picks" className="text-xs whitespace-nowrap px-2 py-1">Test Picks</TabsTrigger>
            )}
            <TabsTrigger value="links" className="text-xs whitespace-nowrap px-2 py-1">Links</TabsTrigger>
            <TabsTrigger value="participants" className="text-xs whitespace-nowrap px-2 py-1">Participants</TabsTrigger>
            <TabsTrigger value="emails" className="text-xs whitespace-nowrap px-2 py-1">Emails</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs whitespace-nowrap px-2 py-1">Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="participants" className="space-y-6 mt-6">
          <ParticipantManagement 
            poolId={pool.id} 
            poolName={pool.name}
          />
        </TabsContent>

        {process.env.NODE_ENV === 'development' && (
          <TabsContent value="test-picks" className="space-y-6 mt-6">
            <TestPicks 
              poolId={pool.id} 
              poolName={pool.name}
              weekNumber={currentWeek}
              seasonType={currentSeasonType}
            />
          </TabsContent>
        )}

        <TabsContent value="links" className="space-y-6 mt-6">
          <ParticipantLinks 
            poolId={pool.id} 
            poolName={pool.name}
            weekNumber={currentWeek}
            seasonType={currentSeasonType}
          />
        </TabsContent>



        <TabsContent value="emails" className="space-y-6 mt-6">
          <EnhancedEmailManagement 
            poolId={pool.id}
            weekNumber={currentWeek}
            adminId={user?.id || ''} // This should be dynamic based on logged in admin
            poolName={pool.name}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 mt-6">
          <PoolSettings 
            poolId={pool.id} 
            poolName={pool.name}
            onPoolDeleted={() => router.push(createPageUrl('adminpools'))}
          />
        </TabsContent>


      </Tabs>
    </div>
  );
}

export default function PoolDetailsPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <PoolDetailsContent />
      </AdminGuard>
    </AuthProvider>
  );
}
