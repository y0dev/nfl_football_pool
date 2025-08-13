'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { loadPool } from '@/actions/loadPools';
import { updatePool } from '@/actions/updatePool';
import { Trash2 } from 'lucide-react';

const poolSettingsSchema = z.object({
  name: z.string().min(3, 'Pool name must be at least 3 characters'),
  description: z.string().optional(),
  require_access_code: z.boolean(),
});

type PoolSettingsData = z.infer<typeof poolSettingsSchema>;

interface PoolSettingsProps {
  poolId: string;
  poolName: string;
  onPoolDeleted?: () => void;
}

export function PoolSettings({ poolId, poolName, onPoolDeleted }: PoolSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const form = useForm<PoolSettingsData>({
    resolver: zodResolver(poolSettingsSchema),
    defaultValues: {
      name: poolName,
      description: '',
      require_access_code: true,
    },
  });

  // Load pool data
  useEffect(() => {
    const loadPoolData = async () => {
      try {
        setIsLoading(true);
        const pool = await loadPool(poolId);
        if (pool) {
          form.reset({
            name: pool.name,
            description: pool.description || '',
            require_access_code: pool.require_access_code,
          });
        }
      } catch (error) {
        console.error('Error loading pool data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load pool settings',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPoolData();
  }, [poolId, form, toast]);

  const onSubmit = async (data: PoolSettingsData) => {
    try {
      setIsSaving(true);
      await updatePool(poolId, {
        name: data.name,
        description: data.description,
        require_access_code: data.require_access_code,
      });
      
      toast({
        title: 'Success',
        description: 'Pool settings updated successfully',
      });
    } catch (error) {
      console.error('Failed to update pool settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update pool settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/admin/pools/${poolId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Pool deleted successfully",
        });
        onPoolDeleted?.();
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
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pool Settings</CardTitle>
          <CardDescription>Loading pool settings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>Pool Settings</CardTitle>
        <CardDescription>
          Configure pool settings and preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pool Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter pool name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter pool description" {...field} />
                  </FormControl>
                  <FormDescription>
                    A brief description of your confidence pool.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="require_access_code"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Require Access Code for Picks
                    </FormLabel>
                    <FormDescription>
                      When enabled, participants must enter an access code to make their picks. 
                      When disabled, participants can make picks directly without any code.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="submit" 
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>

    {/* Danger Zone */}
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <Trash2 className="h-5 w-5" />
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
                    Are you sure you want to delete "{poolName}"? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Delete Pool'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
  );
}
