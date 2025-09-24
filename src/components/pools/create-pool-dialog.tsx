'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPool } from '@/actions/createPool';
import { useAuth } from '@/lib/auth';
import { DEFAULT_POOL_SEASON, PERIOD_WEEKS } from '@/lib/utils';

const poolSchema = z.object({
  name: z.string().min(3, 'Pool name must be at least 3 characters'),
  season: z.number().min(2020, 'Season must be 2020 or later'),
  pool_type: z.enum(['normal', 'knockout']),
});

type PoolFormData = z.infer<typeof poolSchema>;

interface CreatePoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPoolCreated: () => void;
}

export function CreatePoolDialog({ open, onOpenChange, onPoolCreated }: CreatePoolDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const form = useForm<PoolFormData>({
    resolver: zodResolver(poolSchema),
    defaultValues: {
      name: '',
      season: DEFAULT_POOL_SEASON, // Default to current season
      pool_type: 'normal' as const,
    },
  });

  async function onSubmit(data: PoolFormData) {
    if (!user) return;

    setIsLoading(true);
    try {
      await createPool({
        name: data.name,
        created_by: user.email || '',
        season: data.season,
        pool_type: data.pool_type,
      });
      
      console.log('Pool created successfully');
      
      onPoolCreated();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Failed to create pool:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Confidence Pool</DialogTitle>
          <DialogDescription>
            Set up a new NFL confidence pool for the current season.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="season"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Season</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Enter season" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || DEFAULT_POOL_SEASON)}
                      value={field.value}
                    />
                  </FormControl>
                  <FormDescription>
                    The season for which this pool is valid.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pool_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pool Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select pool type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="normal">Normal Pool</SelectItem>
                      <SelectItem value="knockout">Knockout Pool</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Normal pools disable tie breakers during regular weeks (tie breakers only used in tie-breaker weeks {PERIOD_WEEKS.join(', ')}, and Super Bowl in playoffs). 
                    Knockout pools always use tie breakers.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Pool'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
