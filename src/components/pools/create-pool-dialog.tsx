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
import { useMutateAction } from '@uibakery/data';
import createPoolAction from '@/actions/createPool';
import { useAuth } from '@/lib/auth.tsx';
import { useToast } from '@/hooks/use-toast';

const poolSchema = z.object({
  name: z.string().min(3, 'Pool name must be at least 3 characters'),
  description: z.string().optional(),
  entryFee: z.number().min(0, 'Entry fee cannot be negative').max(1000, 'Entry fee cannot exceed $1000'),
  maxParticipants: z.number().min(2, 'Must allow at least 2 participants').max(500, 'Cannot exceed 500 participants').optional(),
  isPublic: z.boolean(),
});

type PoolFormData = z.infer<typeof poolSchema>;

interface CreatePoolDialogProps {
  open: boolean;
  onClose: () => void;
  onPoolCreated: () => void;
}

export function CreatePoolDialog({ open, onClose, onPoolCreated }: CreatePoolDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [createPool] = useMutateAction(createPoolAction);

  const form = useForm<PoolFormData>({
    resolver: zodResolver(poolSchema),
    defaultValues: {
      name: '',
      description: '',
      entryFee: 0,
      maxParticipants: undefined,
      isPublic: true,
    },
  });

  async function onSubmit(data: PoolFormData) {
    if (!user) return;

    setIsLoading(true);
    try {
      await createPool({
        name: data.name,
        description: data.description || null,
        creatorId: user.id,
        entryFee: data.entryFee,
        maxParticipants: data.maxParticipants || null,
        isPublic: data.isPublic,
      });
      
      toast({
        title: 'Pool Created!',
        description: `${data.name} has been created successfully.`,
      });
      
      onPoolCreated();
      onClose();
      form.reset();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create pool. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of your pool" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="entryFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Fee ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxParticipants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Players (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="2"
                        placeholder="Unlimited"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Public Pool</FormLabel>
                    <FormDescription>
                      Allow anyone to discover and join this pool
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
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
