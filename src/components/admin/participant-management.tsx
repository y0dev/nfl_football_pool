'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Loader2, Search, Users, Download, Upload, Edit, Save, X } from 'lucide-react';
import { getPoolParticipants, removeParticipantFromPool, addParticipantToPool, updateParticipantName } from '@/actions/adminActions';
import { AddUserDialog } from './add-user-dialog';
import { useToast } from '@/hooks/use-toast';

// Design tokens
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
  const [isMobile, setIsMobile] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
          <Search style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: textDim, pointerEvents: 'none' }} />
          <Input
            placeholder="Search participants..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2rem', background: card, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.875rem' }}
          />
        </div>
        {selectedParticipants.length > 0 && (
          <button style={btnRed} onClick={handleBulkRemove}>
            <Trash2 style={{ width: 12, height: 12 }} />
            Remove Selected ({selectedParticipants.length})
          </button>
        )}
      </div>

      {/* ── Mobile cards ── */}
      {isMobile && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {activeParticipants.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', background: card, border: `1px solid ${border}`, borderRadius: 8 }}>
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
          ) : activeParticipants.map((participant) => (
            <div
              key={participant.id}
              style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '0.9rem 1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {editingParticipant === participant.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        style={{ height: 30, ...b, fontSize: '0.82rem', background: surface, border: `1px solid ${border}`, color: text, flex: 1 }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit();
                          else if (e.key === 'Escape') handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <button style={{ ...btnGhost, padding: '0.2rem 0.35rem' }} onClick={handleSaveEdit} disabled={isUpdating}>
                        {isUpdating ? <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 12, height: 12 }} />}
                      </button>
                      <button style={{ ...btnGhost, padding: '0.2rem 0.35rem' }} onClick={handleCancelEdit}>
                        <X style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      <span style={{ ...b, fontWeight: 700, fontSize: '0.9rem', color: text }}>{participant.name}</span>
                      <button style={{ ...btnGhost, padding: '0.15rem 0.25rem' }} onClick={() => handleStartEdit(participant)}>
                        <Edit style={{ width: 11, height: 11 }} />
                      </button>
                    </div>
                  )}
                  <p style={{ ...b, fontSize: '0.78rem', color: participant.email ? textMid : textDim, marginBottom: '0.35rem' }}>
                    {participant.email || <em style={{ fontStyle: 'italic' }}>No email</em>}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', ...bc, fontWeight: 700, fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.15rem 0.45rem', borderRadius: 4, background: 'oklch(46% 0.14 155 / 0.15)', color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.3)` }}>
                      Active
                    </span>
                    <span style={{ ...b, fontSize: '0.72rem', color: textDim }}>
                      {new Date(participant.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.55rem', background: 'oklch(50% 0.22 25 / 0.12)', color: 'oklch(65% 0.18 25)', border: `1px solid oklch(50% 0.22 25 / 0.35)`, borderRadius: 5, ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => handleRemoveParticipant(participant.id, participant.name)}
                >
                  <Trash2 style={{ width: 10, height: 10 }} />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      {(!isMobile || isLoading) && (
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.5rem' }}>
            <Loader2 style={{ width: 20, height: 20, color: textDim, animation: 'spin 1s linear infinite' }} />
            <span style={{ ...b, fontSize: '0.85rem', color: textDim }}>Loading participants...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: surface }}>
                  {/* checkbox col */}
                  <th style={{ width: 44, minWidth: 44, padding: '0.625rem 0.75rem', borderBottom: `1px solid ${border}`, textAlign: 'left', verticalAlign: 'middle' }}>
                    <input
                      type="checkbox"
                      checked={selectedParticipants.length === filteredParticipants.length && filteredParticipants.length > 0}
                      onChange={handleSelectAll}
                      style={{ accentColor: green, cursor: 'pointer' }}
                    />
                  </th>
                  {[
                    { label: 'Name',    minWidth: '9rem' },
                    { label: 'Email',   minWidth: '12rem' },
                    { label: 'Joined',  minWidth: '6rem' },
                    { label: 'Status',  minWidth: '5rem' },
                  ].map(({ label, minWidth }) => (
                    <th key={label} style={{ padding: '0.625rem 0.75rem', borderBottom: `1px solid ${border}`, textAlign: 'left', verticalAlign: 'middle', minWidth, whiteSpace: 'nowrap', ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.12em', color: textDim, textTransform: 'uppercase' }}>
                      {label}
                    </th>
                  ))}
                  <th style={{ padding: '0.625rem 0.75rem', borderBottom: `1px solid ${border}`, textAlign: 'right', verticalAlign: 'middle', minWidth: '8rem', whiteSpace: 'nowrap', ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.12em', color: textDim, textTransform: 'uppercase' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeParticipants.map((participant, i) => (
                  <tr
                    key={participant.id}
                    style={{ borderBottom: `1px solid ${border}`, background: i % 2 === 0 ? 'transparent' : 'oklch(18% 0.028 255 / 0.4)' }}
                  >
                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'middle' }}>
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(participant.id)}
                        onChange={() => handleSelectParticipant(participant.id)}
                        style={{ accentColor: green, cursor: 'pointer' }}
                      />
                    </td>

                    {/* Name / edit */}
                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'middle', ...b, fontSize: '0.85rem', color: text, fontWeight: 600 }}>
                      {editingParticipant === participant.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            style={{ height: 30, ...b, fontSize: '0.82rem', background: surface, border: `1px solid ${border}`, color: text, width: 160 }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveEdit();
                              else if (e.key === 'Escape') handleCancelEdit();
                            }}
                            autoFocus
                          />
                          <button style={{ ...btnGhost, padding: '0.2rem 0.35rem' }} onClick={handleSaveEdit} disabled={isUpdating}>
                            {isUpdating ? <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 12, height: 12 }} />}
                          </button>
                          <button style={{ ...btnGhost, padding: '0.2rem 0.35rem' }} onClick={handleCancelEdit}>
                            <X style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{participant.name}</span>
                          <button style={{ ...btnGhost, padding: '0.15rem 0.25rem' }} onClick={() => handleStartEdit(participant)}>
                            <Edit style={{ width: 11, height: 11 }} />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Email */}
                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'middle', ...b, fontSize: '0.82rem', color: participant.email ? textMid : textDim }}>
                      {participant.email || <em style={{ fontStyle: 'italic' }}>No email</em>}
                    </td>

                    {/* Joined date */}
                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'middle', ...b, fontSize: '0.78rem', color: textDim }}>
                      {new Date(participant.created_at).toLocaleDateString()}
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'middle' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', ...bc, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.5rem', borderRadius: 4, background: 'oklch(46% 0.14 155 / 0.15)', color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.3)` }}>
                        Active
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'middle', textAlign: 'right' }}>
                      <button
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.65rem', background: 'oklch(50% 0.22 25 / 0.12)', color: 'oklch(65% 0.18 25)', border: `1px solid oklch(50% 0.22 25 / 0.35)`, borderRadius: 5, ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
                        onClick={() => handleRemoveParticipant(participant.id, participant.name)}
                      >
                        <Trash2 style={{ width: 10, height: 10 }} />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}

                {activeParticipants.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
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
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
