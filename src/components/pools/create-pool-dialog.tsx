'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPool } from '@/actions/createPool';
import { useAuth } from '@/lib/auth';
import { DEFAULT_POOL_SEASON, PERIOD_WEEKS, SEASON_SCOPE_OPTIONS } from '@/lib/utils';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const red     = 'oklch(60% 0.22 25)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const inputStyle = { ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box' as const, fontSize: '0.875rem', marginTop: '0.35rem' };
const labelStyle = { ...bc, fontSize: '0.68rem', fontWeight: 700 as const, color: textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block' };

const poolSchema = z.object({
  name: z.string().min(3, 'Pool name must be at least 3 characters'),
  season: z.number().min(2020, 'Season must be 2020 or later'),
  pool_type: z.enum(['normal', 'knockout']),
  season_scope: z.string(),
  join_password: z.string().optional(),
});

type PoolFormData = z.infer<typeof poolSchema>;

interface CreatePoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPoolCreated: () => void;
}

export function CreatePoolDialog({ open, onOpenChange, onPoolCreated }: CreatePoolDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { user } = useAuth();

  const form = useForm<PoolFormData>({
    resolver: zodResolver(poolSchema),
    defaultValues: { name: '', season: DEFAULT_POOL_SEASON, pool_type: 'normal' as const, season_scope: 'regular', join_password: '' },
  });

  async function onSubmit(data: PoolFormData) {
    if (!user) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const scopeOption = SEASON_SCOPE_OPTIONS.find(o => o.value === data.season_scope);
      await createPool({
        name: data.name,
        created_by: user.email || '',
        season: data.season,
        pool_type: data.pool_type,
        season_scope: scopeOption ? [...scopeOption.types] : [2],
        join_password: data.join_password || undefined,
      });
      onPoolCreated();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Failed to create pool:', error);
      setErrorMsg('Failed to create pool. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '30rem', background: card, border: `1px solid ${border}` }}>
        <DialogHeader>
          <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Create New Confidence Pool</DialogTitle>
          <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim, marginTop: '0.25rem' }}>Set up a new confidence pool for the current season.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Pool Name</FormLabel>
                  <FormControl>
                    <input placeholder="Enter pool name" {...field} style={inputStyle} />
                  </FormControl>
                  <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="season"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Season</FormLabel>
                  <FormControl>
                    <input type="number" placeholder="Enter season" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || DEFAULT_POOL_SEASON)} value={field.value} style={inputStyle} />
                  </FormControl>
                  <FormDescription style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>The season year for this pool.</FormDescription>
                  <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="season_scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Season Scope</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select season scope" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SEASON_SCOPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>
                    {SEASON_SCOPE_OPTIONS.find(o => o.value === form.watch('season_scope'))?.desc ?? 'Which portion of the season this pool covers.'}
                  </FormDescription>
                  <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pool_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Pool Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select pool type" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="normal">Normal Pool</SelectItem>
                      <SelectItem value="knockout">Knockout Pool</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>
                    Normal pools use tie-breakers only in weeks {PERIOD_WEEKS.join(', ')} and Super Bowl. Knockout pools always use tie-breakers.
                  </FormDescription>
                  <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="join_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Join Password <span style={{ color: textDim, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.68rem' }}>(optional)</span></FormLabel>
                  <FormControl>
                    <input placeholder="Leave blank for open access" {...field} style={inputStyle} />
                  </FormControl>
                  <FormDescription style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>If set, participants must enter this password to join from the public pool search page.</FormDescription>
                  <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
                </FormItem>
              )}
            />

            {errorMsg && (
              <p style={{ ...b, fontSize: '0.8rem', color: red, padding: '0.5rem 0.75rem', background: `${red}18`, border: `1px solid ${red}44`, borderRadius: 6 }}>{errorMsg}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
              <button type="button" onClick={() => onOpenChange(false)} disabled={isLoading} style={{ ...bc, padding: '0.5rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={isLoading} style={{ ...bc, padding: '0.5rem 1rem', background: isLoading ? border : green, color: isLoading ? textDim : text, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
                {isLoading ? 'Creating...' : 'Create Pool'}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
