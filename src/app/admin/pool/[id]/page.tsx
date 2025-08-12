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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Edit, Save, X, Users, Trophy, Calendar, Settings, Trash2, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SharePoolButton } from '@/components/pools/share-pool-button';
import { ParticipantManagement } from '@/components/admin/participant-management';
import { SubmissionsScreenshot } from '@/components/admin/submissions-screenshot';
import { EmailManagement } from '@/components/admin/email-management';
import { EnhancedEmailManagement } from '@/components/admin/enhanced-email-management';
import { TestPicks } from '@/components/admin/test-picks';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';

interface Pool {
  id: string;
  name: string;
  description: string;
  created_by: string;
  season: number;
  is_active: boolean;
  created_at: string;
  tie_breaker_method?: string;
  tie_breaker_question?: string;
  tie_breaker_answer?: number;
}

export default function PoolDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.id as string;
  
  const [pool, setPool] = useState<Pool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  // Form state for editing
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    season: 2024,
    is_active: true,
    tie_breaker_method: '',
    tie_breaker_question: '',
    tie_breaker_answer: 0
  });

  useEffect(() => {
    loadPoolData();
    loadCurrentWeekData();
  }, [poolId]);

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
          description: result.pool.description || '',
          season: result.pool.season,
          is_active: result.pool.is_active,
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
    } catch (error) {
      console.error('Error loading current week:', error);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/admin/pools/${poolId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Pool updated successfully",
        });
        setPool(result.pool);
        setIsEditing(false);
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

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/admin/pools/${poolId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Pool deleted successfully",
        });
        router.push('/admin/dashboard');
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete pool",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting pool:', error);
      toast({
        title: "Error",
        description: "Failed to delete pool",
        variant: "destructive",
      });
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
          <p className="text-gray-600 mb-4">The pool you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/admin/dashboard')} variant="outline">
            Back to Dashboard
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
            onClick={() => router.push('/admin/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Pool Title and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">{pool.name}</h1>
            <p className="text-gray-600 text-sm sm:text-base">Pool Management</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SharePoolButton poolId={pool.id} poolName={pool.name} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2"
            >
              {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              <span className="hidden sm:inline">{isEditing ? 'Cancel' : 'Edit'}</span>
            </Button>
            {isEditing && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Pool Status */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
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
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="tie_breaker_method">Tie Breaker Method</Label>
              <Input
                id="tie_breaker_method"
                value={editForm.tie_breaker_method}
                onChange={(e) => setEditForm({ ...editForm, tie_breaker_method: e.target.value })}
                disabled={!isEditing}
                placeholder="e.g., Total Points"
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="tie_breaker_question">Tie Breaker Question</Label>
              <Input
                id="tie_breaker_question"
                value={editForm.tie_breaker_question}
                onChange={(e) => setEditForm({ ...editForm, tie_breaker_question: e.target.value })}
                disabled={!isEditing}
                placeholder="e.g., Total points in Monday night game"
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
      <Tabs defaultValue="participants" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1">
          <TabsTrigger value="participants" className="text-xs sm:text-sm">Participants</TabsTrigger>
          <TabsTrigger value="test-picks" className="text-xs sm:text-sm">Test Picks</TabsTrigger>
          <TabsTrigger value="submissions" className="text-xs sm:text-sm">Submissions</TabsTrigger>
          <TabsTrigger value="emails" className="text-xs sm:text-sm">Emails</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="participants" className="space-y-6">
          <ParticipantManagement 
            poolId={pool.id} 
            poolName={pool.name}
          />
        </TabsContent>

        <TabsContent value="test-picks" className="space-y-6">
          <TestPicks 
            poolId={pool.id} 
            poolName={pool.name}
          />
        </TabsContent>

        <TabsContent value="submissions" className="space-y-6">
          <SubmissionsScreenshot 
            poolId={pool.id} 
            poolName={pool.name}
            week={currentWeek}
          />
        </TabsContent>

        <TabsContent value="emails" className="space-y-6">
          <EnhancedEmailManagement 
            poolId={pool.id}
            weekNumber={currentWeek}
            adminId="1" // This should be dynamic based on logged in admin
            poolName={pool.name}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-red-600 mb-2">Delete Pool</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Once you delete a pool, there is no going back. Please be certain.
                  </p>
                  <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Pool
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Pool</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete "{pool.name}"? This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                          Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                          Delete Pool
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
