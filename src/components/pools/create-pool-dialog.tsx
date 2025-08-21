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
import { createPool } from '@/actions/createPool';
import { useAuth } from '@/lib/auth';

const poolSchema = z.object({
  name: z.string().min(3, 'Pool name must be at least 3 characters'),
  season: z.number().min(2020, 'Season must be 2020 or later'),
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
      season: 2025, // Default to current season
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
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 2025)}
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
