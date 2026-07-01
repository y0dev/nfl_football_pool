'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Loader2, Search, Users, Download, Upload, Edit, Save, X, Mail, Check } from 'lucide-react';
import { getPoolParticipants, removeParticipantFromPool, addParticipantToPool, updateParticipantName } from '@/actions/adminActions';
import { AddUserDialog } from './add-user-dialog';
import { useToast } from '@/hooks/use-toast';

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface Participant {
  id: string;
  name: string;
  email?: string | null;
  created_at: string;
  is_active: boolean;
}

interface ParticipantManagementProps {
  poolId: string;
  poolName: string;
}

const btnBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
  padding: '0.4rem 0.85rem',
  border: `1px solid ${border}`, borderRadius: 6,
  ...bc, fontWeight: 700, fontSize: '0.72rem',
  letterSpacing: '0.07em', textTransform: 'uppercase',
  cursor: 'pointer', whiteSpace: 'nowrap',
  background: 'transparent', color: textMid,
};

const btnGreen: React.CSSProperties = { ...btnBase, background: green, color: text, border: `1px solid ${green}` };
const btnRed: React.CSSProperties   = { ...btnBase, background: 'oklch(38% 0.14 25)', color: text, border: '1px solid oklch(48% 0.16 25)' };
const btnGhost: React.CSSProperties = { ...btnBase, padding: '0.25rem 0.4rem', background: 'transparent', border: '1px solid transparent', color: textDim };

export function ParticipantManagement({ poolId, poolName }: ParticipantManagementProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [bulkAddDialogOpen, setBulkAddDialogOpen] = useState(false);
  const [bulkAddText, setBulkAddText] = useState('');
  const [bulkAddWithEmail, setBulkAddWithEmail] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadParticipants(); }, [poolId]);

  useEffect(() => {
    const filtered = participants.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredParticipants(filtered);
  }, [participants, searchTerm]);

  const loadParticipants = async () => {
    setIsLoading(true);
    try {
      const data = await getPoolParticipants(poolId);
      setParticipants(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load participants', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId: string, participantName: string) => {
    if (!confirm(`Are you sure you want to remove ${participantName} from the pool?`)) return;
    try {
      await removeParticipantFromPool(participantId);
      toast({ title: 'Success', description: `${participantName} has been removed from the pool` });
      loadParticipants();
    } catch {
      toast({ title: 'Error', description: 'Failed to remove participant', variant: 'destructive' });
    }
  };

  const handleBulkRemove = async () => {
    if (selectedParticipants.length === 0) {
      toast({ title: 'Warning', description: 'Please select participants to remove', variant: 'destructive' });
      return;
    }
    if (!confirm(`Are you sure you want to remove ${selectedParticipants.length} participant(s) from the pool?`)) return;
    try {
      for (const id of selectedParticipants) await removeParticipantFromPool(id);
      toast({ title: 'Success', description: `${selectedParticipants.length} participant(s) removed` });
      setSelectedParticipants([]);
      loadParticipants();
    } catch {
      toast({ title: 'Error', description: 'Failed to remove some participants', variant: 'destructive' });
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkAddText.trim()) {
      toast({ title: 'Error', description: 'Please enter participant data', variant: 'destructive' });
      return;
    }
    const lines = bulkAddText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      toast({ title: 'Error', description: 'No valid data found', variant: 'destructive' });
      return;
    }
    try {
      for (const line of lines) {
        if (bulkAddWithEmail) {
          const parts = line.includes(',') ? line.split(',') : line.split(' ');
          const name = parts[0]?.trim();
          const email = parts[1]?.trim() || '';
          if (name) await addParticipantToPool(poolId, name, email);
        } else {
          await addParticipantToPool(poolId, line, '');
        }
      }
      toast({ title: 'Success', description: `${lines.length} participant(s) added` });
      setBulkAddText('');
      setBulkAddWithEmail(false);
      setBulkAddDialogOpen(false);
      loadParticipants();
    } catch {
      toast({ title: 'Error', description: 'Failed to add some participants', variant: 'destructive' });
    }
  };

  const handleStartEdit = (participant: Participant) => {
    setEditingParticipant(participant.id);
    setEditName(participant.name);
  };

  const handleCancelEdit = () => {
    setEditingParticipant(null);
    setEditName('');
  };

  const handleSaveEdit = async () => {
    if (!editingParticipant || !editName.trim()) {
      toast({ title: 'Error', description: 'Please enter a valid name', variant: 'destructive' });
      return;
    }
    try {
      setIsUpdating(true);
      await updateParticipantName(editingParticipant, editName.trim());
      toast({ title: 'Success', description: 'Participant name updated' });
      setEditingParticipant(null);
      setEditName('');
      loadParticipants();
    } catch {
      toast({ title: 'Error', description: 'Failed to update participant name', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSelectAll = () => {
    setSelectedParticipants(
      selectedParticipants.length === filteredParticipants.length ? [] : filteredParticipants.map(p => p.id)
    );
  };

  const handleSelectParticipant = (participantId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(participantId) ? prev.filter(id => id !== participantId) : [...prev, participantId]
    );
  };

  const exportParticipants = () => {
    const csvContent = [
      ['Name', 'Email', 'Joined Date', 'Status'],
      ...filteredParticipants.map(p => [
        p.name, p.email || '', new Date(p.created_at).toLocaleDateString(), p.is_active ? 'Active' : 'Inactive',
      ]),
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${poolName}-participants.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeParticipants = filteredParticipants.filter(p => p.is_active);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Header card ── */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <Users style={{ width: 16, height: 16, color: greenHi }} />
              <h2 style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Pool Participants
              </h2>
              <span style={{
                ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em',
                padding: '0.1rem 0.45rem', borderRadius: 4, textTransform: 'uppercase',
                background: 'oklch(46% 0.14 155 / 0.18)', color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.35)`,
              }}>{activeParticipants.length}</span>
            </div>
            <p style={{ ...b, fontSize: '0.8rem', color: textMid }}>Manage participants in {poolName}</p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button style={btnBase} onClick={exportParticipants}>
              <Download style={{ width: 12, height: 12 }} />
              Export
            </button>

            <Dialog open={bulkAddDialogOpen} onOpenChange={setBulkAddDialogOpen}>
              <DialogTrigger asChild>
                <button style={btnBase}>
                  <Upload style={{ width: 12, height: 12 }} />
                  Bulk Add
                </button>
              </DialogTrigger>
              <DialogContent style={{ background: card, border: `1px solid ${border}`, color: text, maxWidth: 480, width: '95vw' }}>
                <DialogHeader>
                  <DialogTitle style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Bulk Add Participants
                  </DialogTitle>
                  <DialogDescription style={{ ...b, fontSize: '0.82rem', color: textMid }}>
                    Add multiple participants at once.
                  </DialogDescription>
                </DialogHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={bulkAddWithEmail}
                      onChange={e => setBulkAddWithEmail(e.target.checked)}
                      style={{ accentColor: green }}
                    />
                    <span style={{ ...b, fontSize: '0.85rem', color: textMid }}>Include email addresses</span>
                  </label>
                  <div>
                    <Label style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', marginBottom: '0.4rem', display: 'block' }}>
                      {bulkAddWithEmail ? 'Participant Data (one per line)' : 'Participant Names (one per line)'}
                    </Label>
                    <textarea
                      value={bulkAddText}
                      onChange={e => setBulkAddText(e.target.value)}
                      placeholder={
                        bulkAddWithEmail
                          ? 'John Doe,john@example.com\nJane Smith jane@example.com\nMike Johnson'
                          : 'John Doe\nJane Smith\nMike Johnson'
                      }
                      rows={5}
                      style={{
                        width: '100%', padding: '0.6rem 0.75rem',
                        background: surface, border: `1px solid oklch(30% 0.03 255)`,
                        color: text, borderRadius: 6, resize: 'vertical',
                        ...b, fontSize: '0.85rem', boxSizing: 'border-box',
                      }}
                    />
                    {bulkAddWithEmail && (
                      <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.3rem' }}>
                        Format: &quot;Name,email@example.com&quot; or &quot;Name email@example.com&quot;
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter style={{ gap: '0.5rem' }}>
                  <button style={btnBase} onClick={() => { setBulkAddDialogOpen(false); setBulkAddText(''); setBulkAddWithEmail(false); }}>
                    Cancel
                  </button>
                  <button style={btnGreen} onClick={handleBulkAdd}>
                    Add Participants
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AddUserDialog poolId={poolId} poolName={poolName} onUserAdded={loadParticipants} />
          </div>
        </div>
      </div>

      {/* ── Search + Bulk Remove ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 0', minWidth: 0 }}>
          {filteredParticipants.length > 0 && (
            <button
              onClick={handleSelectAll}
              style={{ ...btnGhost, flexShrink: 0, fontSize: '0.68rem', padding: '0.25rem 0.5rem', color: textDim }}
            >
              {selectedParticipants.length === filteredParticipants.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <Search style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: textDim, pointerEvents: 'none' }} />
            <Input
              placeholder="Search participants..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2rem', background: card, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.875rem' }}
            />
          </div>
        </div>
        {selectedParticipants.length > 0 && (
          <button style={btnRed} onClick={handleBulkRemove}>
            <Trash2 style={{ width: 12, height: 12 }} />
            Remove Selected ({selectedParticipants.length})
          </button>
        )}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.5rem' }}>
          <Loader2 style={{ width: 20, height: 20, color: textDim, animation: 'spin 1s linear infinite' }} />
          <span style={{ ...b, fontSize: '0.85rem', color: textDim }}>Loading participants...</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && activeParticipants.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: card, border: `1px solid ${border}`, borderRadius: 10 }}>
          <Users style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
          <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '0.4rem' }}>
            {searchTerm ? 'No participants match your search.' : 'No participants yet.'}
          </p>
          {!searchTerm && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
              <AddUserDialog poolId={poolId} poolName={poolName} onUserAdded={loadParticipants} />
              <button style={btnBase} onClick={() => setBulkAddDialogOpen(true)}>
                <Upload style={{ width: 12, height: 12 }} />
                Bulk Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Participant cards ── */}
      {!isLoading && activeParticipants.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.6rem' }}>
          {activeParticipants.map(participant => {
            const isEditing = editingParticipant === participant.id;
            const isSelected = selectedParticipants.includes(participant.id);

            return (
              <div
                key={participant.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  background: isSelected ? 'oklch(46% 0.14 155 / 0.07)' : card,
                  border: `1px solid ${isSelected ? 'oklch(46% 0.14 155 / 0.35)' : border}`,
                  borderRadius: 10,
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
              >
                {/* Selectable avatar */}
                <button
                  className='member-avatar'
                  onClick={() => handleSelectParticipant(participant.id)}
                  title={isSelected ? 'Deselect' : 'Select'}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: 'none', flexShrink: 0, cursor: 'pointer',
                    background: isSelected ? green : 'oklch(26% 0.03 255)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    ...bc, fontWeight: 800, fontSize: '0.9rem',
                    color: isSelected ? '#fff' : textMid,
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                >
                  {isSelected
                    ? <Check style={{ width: 16, height: 16 }} />
                    : participant.name.charAt(0).toUpperCase()}
                </button>

                {/* Name / email / date */}
                <div className='member-info' style={{ flex: 1, minWidth: 0 }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        style={{ height: 30, ...b, fontSize: '0.82rem', background: surface, border: `1px solid ${border}`, color: text }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit();
                          else if (e.key === 'Escape') handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          style={{ ...btnGreen, padding: '0.25rem 0.6rem', fontSize: '0.65rem' }}
                          onClick={handleSaveEdit}
                          disabled={isUpdating}
                        >
                          {isUpdating
                            ? <Loader2 style={{ width: 11, height: 11, animation: 'spin 1s linear infinite' }} />
                            : <Save style={{ width: 11, height: 11 }} />}
                          Save
                        </button>
                        <button style={{ ...btnBase, padding: '0.25rem 0.6rem', fontSize: '0.65rem' }} onClick={handleCancelEdit}>
                          <X style={{ width: 11, height: 11 }} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span style={{ ...b, fontWeight: 700, fontSize: '0.88rem', color: text, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {participant.name}
                      </span>
                      {participant.email ? (
                        <span style={{ ...b, fontSize: '0.75rem', color: textMid, display: 'flex', alignItems: 'center', gap: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.15rem' }}>
                          <Mail style={{ width: 11, height: 11, flexShrink: 0, color: textDim }} />
                          {participant.email}
                        </span>
                      ) : (
                        <span style={{ ...b, fontSize: '0.75rem', color: textDim, fontStyle: 'italic', marginTop: '0.15rem', display: 'block' }}>
                          No email
                        </span>
                      )}
                      <span style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.3rem', display: 'block' }}>
                        Joined {new Date(participant.created_at).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>

                {/* Action buttons */}
                {!isEditing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
                    <button
                      style={{ ...btnGhost, padding: '0.3rem', color: textDim }}
                      onClick={() => handleStartEdit(participant)}
                      title="Edit name"
                    >
                      <Edit style={{ width: 14, height: 14 }} />
                    </button>
                    <button
                      style={{ ...btnGhost, padding: '0.3rem', color: 'oklch(52% 0.18 25)' }}
                      onClick={() => handleRemoveParticipant(participant.id, participant.name)}
                      title="Remove participant"
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
