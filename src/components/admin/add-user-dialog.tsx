'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { addParticipantToPool } from '@/actions/adminActions';
import { useToast } from '@/hooks/use-toast';

const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const inputStyle = { ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box' as const, fontSize: '0.875rem' };
const labelStyle = { ...bc, fontSize: '0.68rem', fontWeight: 700 as const, color: textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' };

interface AddUserDialogProps {
  poolId: string;
  poolName: string;
  onUserAdded: () => void;
}

export function AddUserDialog({ poolId, poolName, onUserAdded }: AddUserDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      await addParticipantToPool(poolId, name, email);
      toast({ title: 'Success', description: `${name} has been added to ${poolName}` });
      setName(''); setEmail('');
      setIsOpen(false);
      onUserAdded();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to add user', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) { setName(''); setEmail(''); }
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          padding: '0.4rem 0.85rem', background: green, color: text,
          border: 'none', borderRadius: 6, cursor: 'pointer',
          ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
          <Plus style={{ width: 13, height: 13 }} />
          Add User
        </button>
      </DialogTrigger>
      <DialogContent style={{ maxWidth: '26rem', background: card, border: `1px solid ${border}` }}>
        <DialogHeader>
          <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Add User to Pool</DialogTitle>
          <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim, marginTop: '0.25rem' }}>
            Add a new participant to {poolName}. They will be able to submit picks for upcoming weeks.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.5rem 0' }}>
            <div>
              <label htmlFor="add-name" style={labelStyle}>Name *</label>
              <input id="add-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter participant name" disabled={isLoading} required style={inputStyle} />
            </div>
            <div>
              <label htmlFor="add-email" style={labelStyle}>Email (Optional)</label>
              <input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email address" disabled={isLoading} style={inputStyle} />
            </div>
          </div>
          <DialogFooter style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setIsOpen(false)} disabled={isLoading} style={{ ...bc, padding: '0.45rem 0.85rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={isLoading} style={{ ...bc, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: isLoading ? border : green, color: isLoading ? textDim : text, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
              {isLoading && <Loader2 style={{ width: 12, height: 12, animation: 'spin 0.8s linear infinite' }} />}
              {isLoading ? 'Adding...' : 'Add User'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
