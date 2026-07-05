'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPool } from '@/actions/createPool';
import { addParticipantToPool } from '@/actions/adminActions';
import { useAuth } from '@/lib/auth';
import { isPricingVisible } from '@/lib/billing';
import { DEFAULT_POOL_SEASON, PERIOD_WEEKS, SEASON_SCOPE_OPTIONS, debugError, debugWarn} from '@/lib/utils';

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
  pool_type: z.literal('normal'),
  season_scope: z.string(),
  join_password: z.string().optional(),
  is_private: z.boolean(),
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
  const [limitReached, setLimitReached] = useState(false);
  const [includeSelf, setIncludeSelf] = useState(false);
  const { user } = useAuth();

  const form = useForm<PoolFormData>({
    resolver: zodResolver(poolSchema),
    defaultValues: { name: '', season: DEFAULT_POOL_SEASON, pool_type: 'normal' as const, season_scope: 'regular', join_password: '', is_private: false },
  });

  async function onSubmit(data: PoolFormData) {
    if (!user) return;
    setIsLoading(true);
    setErrorMsg('');
    setLimitReached(false);
    try {
      const scopeOption = SEASON_SCOPE_OPTIONS.find(o => o.value === data.season_scope);
      const result = await createPool({
        name: data.name,
        created_by: user.email || '',
        season: data.season,
        pool_type: data.pool_type,
        season_scope: scopeOption ? [...scopeOption.types] : [2],
        join_password: data.join_password || undefined,
        is_private: data.is_private,
      });

      if (!result.success) {
        if (result.limitReached) setLimitReached(true);
        setErrorMsg(result.error);
        return;
      }

      const pool = result.data;
      if (includeSelf && pool?.id && user.email) {
        try {
          await addParticipantToPool(pool.id as string, user.full_name || user.email, user.email);
        } catch (selfError) {
          debugWarn('[SH][UI][POOL] Could not add commissioner as participant:', selfError);
        }
      }

      onPoolCreated();
      onOpenChange(false);
      form.reset();
      setIncludeSelf(false);
      setLimitReached(false);
    } catch (error) {
      debugError('Failed to create pool:', error);
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
                      <SelectTrigger style={{ ...b, background: surface, border: `1px solid ${border}`, color: text, height: '2.25rem', fontSize: '0.875rem', marginTop: '0.35rem' }}>
                        <SelectValue placeholder="Select season scope" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent style={{ background: card, border: `1px solid ${border}`, color: text, zIndex: 9999 }}>
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
                      <SelectTrigger style={{ ...b, background: surface, border: `1px solid ${border}`, color: text, height: '2.25rem', fontSize: '0.875rem', marginTop: '0.35rem' }}>
                        <SelectValue placeholder="Select pool type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent style={{ background: card, border: `1px solid ${border}`, color: text, zIndex: 9999 }}>
                      <SelectItem value="normal">Normal Pool</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>
                    Uses tie-breakers in weeks {PERIOD_WEEKS.join(', ')} and the Super Bowl.
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
                  {!form.watch('is_private') && form.watch('join_password') && (
                    <p style={{ ...b, fontSize: '0.72rem', color: 'oklch(74% 0.16 72)', marginTop: '0.25rem' }}>
                      Members will need this password to join from the search page.
                    </p>
                  )}
                  <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_private"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Visibility</FormLabel>
                  <div style={{ display: 'flex', gap: '0.35rem', background: 'oklch(13% 0.025 255)', border: `1px solid ${border}`, borderRadius: 6, padding: '0.25rem', marginTop: '0.35rem' }}>
                    {([false, true] as const).map((val) => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => field.onChange(val)}
                        style={{
                          flex: 1, padding: '0.4rem 0.75rem',
                          background: field.value === val ? (val ? 'oklch(62% 0.22 25 / 0.18)' : green) : 'transparent',
                          color: field.value === val ? (val ? 'oklch(72% 0.18 25)' : text) : textDim,
                          border: `1px solid ${field.value === val ? (val ? 'oklch(62% 0.22 25 / 0.4)' : green) : 'transparent'}`,
                          borderRadius: 4,
                          ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        {val ? 'Private' : 'Public'}
                      </button>
                    ))}
                  </div>
                  <FormDescription style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>
                    {field.value
                      ? 'Invitation only. This pool will not appear in search results.'
                      : 'Anyone can find this pool by searching. A password still restricts who can join.'}
                  </FormDescription>
                </FormItem>
              )}
            />

            {/* Include self as participant */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeSelf}
                onChange={e => setIncludeSelf(e.target.checked)}
                style={{ marginTop: 3, flexShrink: 0, accentColor: green, width: 14, height: 14 }}
              />
              <div>
                <span style={{ ...b, fontSize: '0.83rem', color: textMid }}>Add myself as a participant</span>
                <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.1rem', margin: 0 }}>
                  Your name and email will be added to this pool automatically.
                </p>
              </div>
            </label>

            {errorMsg && (
              limitReached ? (
                <div style={{ padding: '0.85rem 1rem', background: `oklch(74% 0.16 72 / 0.08)`, border: `1px solid oklch(74% 0.16 72 / 0.35)`, borderRadius: 8 }}>
                  <p style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: 'oklch(74% 0.16 72)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Pool Limit Reached</p>
                  {/* Preseason test pools have a flat cap — upgrading doesn't raise it */}
                  {isPricingVisible() && !errorMsg.toLowerCase().includes('preseason') ? (
                    <>
                      <p style={{ ...b, fontSize: '0.82rem', color: textMid, marginBottom: '0.6rem' }}>{errorMsg} Upgrade your plan to run additional pools.</p>
                      <a href="/upgrade" style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: 'oklch(74% 0.16 72)', textDecoration: 'underline', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        View upgrade options →
                      </a>
                    </>
                  ) : (
                    <p style={{ ...b, fontSize: '0.82rem', color: textMid, margin: 0 }}>{errorMsg}</p>
                  )}
                </div>
              ) : (
                <p style={{ ...b, fontSize: '0.8rem', color: red, padding: '0.5rem 0.75rem', background: `${red}18`, border: `1px solid ${red}44`, borderRadius: 6 }}>{errorMsg}</p>
              )
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
