'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { loadPool } from '@/actions/loadPools';
import { updatePool } from '@/actions/updatePool';
import { Trash2, Lock, Settings, Save } from 'lucide-react';
import { DEFAULT_POOL_SEASON, SEASON_SCOPE_OPTIONS, seasonTypesToScopeValue } from '@/lib/utils';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const amber   = 'oklch(72% 0.16 60)';
const red     = 'oklch(60% 0.22 25)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const cardStyle = { background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' };
const labelStyle = { ...bc, fontSize: '0.68rem', fontWeight: 700 as const, color: textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' };
const inputStyle = { ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box' as const, fontSize: '0.875rem' };

const poolSettingsSchema = z.object({
  name: z.string().min(3, 'Pool name must be at least 3 characters'),
  season: z.number().min(2020, 'Season must be 2020 or later'),
  is_active: z.boolean(),
  is_private: z.boolean(),
  join_password: z.string().optional(),
  season_scope: z.string(),
  tie_breaker_method: z.string().optional(),
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
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isClosingSeason, setIsClosingSeason] = useState(false);
  const [closeSeasonResult, setCloseSeasonResult] = useState<{ winner?: string; message?: string } | null>(null);
  const { toast } = useToast();

  const form = useForm<PoolSettingsData>({
    resolver: zodResolver(poolSettingsSchema),
    defaultValues: {
      name: poolName,
      season: DEFAULT_POOL_SEASON,
      is_active: true,
      is_private: false,
      join_password: '',
      season_scope: 'regular',
      tie_breaker_method: 'none',
    },
  });

  useEffect(() => {
    const loadPoolData = async () => {
      try {
        setIsLoading(true);
        const pool = await loadPool(poolId);
        if (pool) {
          form.reset({
            name: pool.name,
            season: pool.season,
            is_active: pool.is_active,
            is_private: pool.is_private ?? false,
            join_password: pool.join_password ?? '',
            season_scope: seasonTypesToScopeValue(pool.season_scope ?? [2]),
            tie_breaker_method: pool.tie_breaker_method || 'none',
          });
        }
      } catch (error) {
        console.error('Error loading pool data:', error);
        toast({ title: 'Error', description: 'Failed to load pool settings', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    loadPoolData();
  }, [poolId, form, toast]);

  const onSubmit = async (data: PoolSettingsData) => {
    try {
      setIsSaving(true);
      const scopeOption = SEASON_SCOPE_OPTIONS.find(o => o.value === data.season_scope);
      await updatePool(poolId, {
        name: data.name,
        season: data.season,
        is_active: data.is_active,
        is_private: data.is_private,
        join_password: data.join_password || null,
        season_scope: scopeOption ? [...scopeOption.types] : [2],
        tie_breaker_method: data.tie_breaker_method,
      });
      toast({ title: 'Success', description: 'Pool settings updated successfully' });
    } catch (error) {
      console.error('Failed to update pool settings:', error);
      toast({ title: 'Error', description: 'Failed to update pool settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/admin/pools/${poolId}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        const d = result.deletedData || {};
        const total = (d.participants || 0) + (d.picks || 0) + (d.scores || 0) + (d.tieBreakers || 0);
        let description = 'Pool deleted successfully';
        if (total > 0) {
          description += `. Also deleted: ${d.participants || 0} participants, ${d.picks || 0} picks, ${d.scores || 0} scores, and ${d.tieBreakers || 0} tie breakers.`;
        }
        toast({ title: 'Success', description });
        onPoolDeleted?.();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to delete pool', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting pool:', error);
      toast({ title: 'Error', description: 'Failed to delete pool', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteConfirmation('');
    }
  };

  const handleCloseSeason = async () => {
    try {
      setIsClosingSeason(true);
      setCloseSeasonResult(null);
      const response = await fetch('/api/admin/close-season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId }),
      });
      const result = await response.json();
      if (result.success) {
        const winner = result.winnersComputed?.[0] ?? result.winnersAlreadyExist?.[0] ?? null;
        setCloseSeasonResult({
          winner: winner ? String(winner) : undefined,
          message: result.closed?.length > 0 ? 'Season closed and locked successfully.' : 'Pool was already closed.',
        });
        toast({ title: 'Season Closed', description: 'Pool locked and winner recorded.' });
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to close season', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error closing season:', error);
      toast({ title: 'Error', description: 'Failed to close season', variant: 'destructive' });
    } finally {
      setIsClosingSeason(false);
    }
  };

  if (isLoading) {
    return (
      <div style={cardStyle}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pool Settings</p>
        <div style={{ marginTop: '0.85rem' }}>
          {[['75%'], ['50%'], ['66%']].map(([w], i) => (
            <div key={i} style={{ height: 12, background: surface, borderRadius: 4, marginBottom: '0.5rem', width: w }} />
          ))}
        </div>
      </div>
    );
  }

  const deleteMatch = deleteConfirmation === poolName;
  const deleteTyped = deleteConfirmation.length > 0;
  const watchedScope = form.watch('season_scope');
  const scopeDesc = SEASON_SCOPE_OPTIONS.find(o => o.value === watchedScope)?.desc ?? '';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* General Settings */}
        <div style={{ ...cardStyle, borderLeft: `3px solid ${green}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Settings style={{ width: 16, height: 16, color: greenHi }} />
            <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>General Settings</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Pool Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Pool Name</FormLabel>
                  <FormControl>
                    <input {...field} style={inputStyle} placeholder="Enter pool name" />
                  </FormControl>
                  <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
                </FormItem>
              )}
            />

            {/* Season Scope */}
            <FormField
              control={form.control}
              name="season_scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Season Scope</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text }}>
                        <SelectValue placeholder="Select season scope" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SEASON_SCOPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {scopeDesc && (
                    <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.3rem' }}>{scopeDesc}</p>
                  )}
                  <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
                </FormItem>
              )}
            />

            {/* Active status */}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Pool Status</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === 'true')} value={String(field.value)}>
                    <FormControl>
                      <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text }}>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">Active — accepting picks</SelectItem>
                      <SelectItem value="false">Inactive — locked</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage style={{ ...b, fontSize: '0.75rem', color: red, marginTop: '0.2rem' }} />
                </FormItem>
              )}
            />

            {/* Join password */}
            <FormField
              control={form.control}
              name="join_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Join Password <span style={{ color: textDim, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.68rem' }}>(optional)</span></FormLabel>
                  <FormControl>
                    <input {...field} placeholder="Leave blank for open access" style={inputStyle} />
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

            {/* Visibility */}
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
                  <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>
                    {field.value
                      ? 'Invitation only. This pool will not appear in search results.'
                      : 'Anyone can find this pool by searching. A password still restricts who can join.'}
                  </p>
                </FormItem>
              )}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button
              type="submit"
              disabled={isSaving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: isSaving ? surface : green, color: isSaving ? textDim : text, border: 'none', borderRadius: 6, cursor: isSaving ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              <Save style={{ width: 13, height: 13 }} />
              {isSaving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Close Season */}
        <div style={{ ...cardStyle, border: `1px solid color-mix(in oklch, ${amber} 35%, ${border})` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <Lock style={{ width: 16, height: 16, color: amber }} />
            <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: amber, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Close Season</p>
          </div>
          <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>
            Lock this pool, prevent new picks, and compute the final season winner.
          </p>
          <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginBottom: '1rem' }}>
            Use this when the NFL season is over. The pool will be set to inactive and the season winner will be computed from all scores and saved permanently.
          </p>

          {closeSeasonResult && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: `color-mix(in oklch, ${amber} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${amber} 30%, ${border})`, borderRadius: 6 }}>
              <p style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: amber, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>{closeSeasonResult.message}</p>
              {closeSeasonResult.winner && (
                <p style={{ ...b, fontSize: '0.8rem', color: textMid }}>Winner: {closeSeasonResult.winner}</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleCloseSeason}
            disabled={isClosingSeason}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'transparent', color: isClosingSeason ? textDim : amber, border: `1px solid color-mix(in oklch, ${amber} 50%, ${border})`, borderRadius: 6, cursor: isClosingSeason ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            <Lock style={{ width: 13, height: 13 }} />
            {isClosingSeason ? 'Closing Season…' : 'Close & Lock Season'}
          </button>
        </div>

        {/* Danger Zone */}
        <div style={{ ...cardStyle, border: `1px solid color-mix(in oklch, ${red} 35%, ${border})` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <Trash2 style={{ width: 16, height: 16, color: red }} />
            <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: red, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Danger Zone</p>
          </div>
          <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>Irreversible and destructive actions</p>

          <p style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: red, marginBottom: '0.35rem' }}>Delete Pool</p>
          <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginBottom: '0.85rem' }}>
            Once you delete a pool, there is no going back. Please be certain.
          </p>

          <Dialog
            open={showDeleteDialog}
            onOpenChange={(open) => {
              setShowDeleteDialog(open);
              if (!open) setDeleteConfirmation('');
            }}
          >
            <DialogTrigger asChild>
              <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', background: `color-mix(in oklch, ${red} 15%, ${surface})`, color: red, border: `1px solid color-mix(in oklch, ${red} 40%, ${border})`, borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <Trash2 style={{ width: 12, height: 12 }} />
                Delete Pool
              </button>
            </DialogTrigger>
            <DialogContent style={{ maxWidth: '28rem', background: card, border: `1px solid ${border}` }}>
              <DialogHeader>
                <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: red, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Delete Pool</DialogTitle>
                <DialogDescription asChild>
                  <div style={{ ...b, fontSize: '0.8rem', color: textDim }}>
                    <p style={{ marginBottom: '0.5rem' }}>Are you sure you want to delete &quot;{poolName}&quot;? This action cannot be undone.</p>
                    <p style={{ ...b, fontWeight: 700, color: textMid, marginBottom: '0.35rem' }}>This will also permanently delete:</p>
                    <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {['All participants in this pool', 'All picks submitted by participants', 'All scores and standings', 'All tie breaker responses'].map(item => (
                        <li key={item} style={{ listStyleType: 'disc', ...b, fontSize: '0.78rem', color: textDim }}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div style={{ padding: '0.75rem 0' }}>
                <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginBottom: '0.5rem' }}>
                  To confirm deletion, type <span style={{ fontFamily: 'monospace', fontWeight: 700, color: red }}>{poolName}</span> below:
                </p>
                <input
                  type="text"
                  placeholder="Enter pool name to confirm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  style={{ ...inputStyle, border: `1px solid ${deleteTyped ? (deleteMatch ? 'oklch(50% 0.14 155)' : red) : border}` }}
                />
                {deleteTyped && (
                  <p style={{ ...b, fontSize: '0.75rem', color: deleteMatch ? 'oklch(59% 0.15 155)' : red, marginTop: '0.25rem' }}>
                    {deleteMatch ? '✓ Pool name matches — deletion enabled' : '✗ Pool name does not match'}
                  </p>
                )}
              </div>

              <DialogFooter style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setShowDeleteDialog(false)} style={{ ...bc, padding: '0.45rem 0.85rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting || !deleteMatch}
                  style={{ ...bc, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: isDeleting || !deleteMatch ? surface : `color-mix(in oklch, ${red} 20%, ${surface})`, color: isDeleting || !deleteMatch ? textDim : red, border: `1px solid ${isDeleting || !deleteMatch ? border : `color-mix(in oklch, ${red} 40%, ${border})`}`, borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: isDeleting || !deleteMatch ? 'not-allowed' : 'pointer' }}
                >
                  <Trash2 style={{ width: 12, height: 12 }} />
                  {isDeleting ? 'Deleting...' : 'Delete Pool'}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

      </form>
    </Form>
  );
}
