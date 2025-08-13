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
import { useToast } from '@/hooks/use-toast';
import { loadPool } from '@/actions/loadPools';
import { updatePool } from '@/actions/updatePool';

const poolSettingsSchema = z.object({
  name: z.string().min(3, 'Pool name must be at least 3 characters'),
  description: z.string().optional(),
  require_access_code: z.boolean(),
});

type PoolSettingsData = z.infer<typeof poolSettingsSchema>;

interface PoolSettingsProps {
  poolId: string;
  poolName: string;
}

export function PoolSettings({ poolId, poolName }: PoolSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  );
}
