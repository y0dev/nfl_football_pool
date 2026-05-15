'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadUsers } from '@/actions/loadUsers';
import { useAuth } from '@/lib/auth';
import { Trophy, User } from 'lucide-react';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const labelStyle = { ...bc, fontSize: '0.68rem', fontWeight: 700 as const, color: textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' };

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface UserSelectionProps {
  poolId?: string;
  week?: number;
  onUserSelected?: (user: UserOption) => void;
}

export function UserSelection({ poolId, week, onUserSelected }: UserSelectionProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const { signIn } = useAuth();

  useEffect(() => {
    async function fetchUsers() {
      try {
        const usersData = await loadUsers(poolId, week);
        setUsers(usersData);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, [poolId, week]);

  async function handleContinue() {
    if (!selectedUserId) return;
    setIsLoading(true);
    const selectedUser = users.find(u => u.id === selectedUserId);
    if (!selectedUser) { setIsLoading(false); return; }
    if (onUserSelected) {
      onUserSelected(selectedUser);
    } else {
      signIn(selectedUser.email, '');
      console.log(`Logged in as ${selectedUser.name}`);
    }
    setIsLoading(false);
  }

  const wrapStyle = { width: '100%', maxWidth: '28rem', margin: '0 auto', background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.75rem' };

  if (loadingUsers) {
    return (
      <div style={wrapStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <Trophy style={{ width: 28, height: 28, color: textDim, marginBottom: '0.5rem' }} />
          <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>Loading users...</p>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div style={wrapStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center' }}>
          <User style={{ width: 36, height: 36, color: textDim, marginBottom: '0.65rem' }} />
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>No Available Users</p>
          <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>
            {poolId && week
              ? 'All users have already submitted their picks for this week.'
              : 'No users are available at this time.'}
          </p>
        </div>
      </div>
    );
  }

  const continueDisabled = !selectedUserId || isLoading;

  return (
    <div style={wrapStyle}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.65rem' }}>
          <User style={{ width: 28, height: 28, color: textMid }} />
        </div>
        <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Select Your Name</p>
        <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>
          {poolId && week
            ? `Choose your name to submit picks for Week ${week}`
            : 'Choose your name from the list to continue'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div>
          <label style={labelStyle}>Your Name</label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger><SelectValue placeholder="Select your name..." /></SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <button
          onClick={handleContinue}
          disabled={continueDisabled}
          style={{ ...bc, width: '100%', padding: '0.6rem', background: continueDisabled ? border : green, color: continueDisabled ? textDim : text, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: continueDisabled ? 'not-allowed' : 'pointer' }}
        >
          {isLoading ? 'Loading...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
