'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { loadUsers } from '@/actions/loadUsers';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { userSessionManager } from '@/lib/user-session';
import { debugLog, getWeekTitle, debugError} from '@/lib/utils';
import { Target, Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Leaderboard } from '@/components/leaderboard/leaderboard';

// Design tokens
const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface PickUserSelectionProps {
  poolId: string;
  weekNumber?: number;
  seasonType?: number;
  onUserSelected: (userId: string, userName: string) => void;
  usersNeedingConfidencePoints?: number;
  poolSeason?: number;
}

export function PickUserSelection({ poolId, weekNumber, seasonType, onUserSelected, usersNeedingConfidencePoints, poolSeason }: PickUserSelectionProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  // Handle SSR - only run on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      loadData();
    }
  }, [isMounted, poolId, weekNumber, seasonType]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Use provided week number or load current week
      let weekToUse = weekNumber;
      if (!weekToUse) {
        const weekData = await loadCurrentWeek();
        weekToUse = weekData?.week_number || 1;
      }
      setCurrentWeek(weekToUse);

      // Load users who haven't submitted picks for this specific pool, week, and season type
      const availableUsers = await loadUsers(poolId, weekToUse, seasonType || 2);

      // Ensure we have an array of users
      if (Array.isArray(availableUsers)) {
        setUsers(availableUsers);
      } else {
        debugError('loadUsers returned non-array:', availableUsers);
        setUsers([]);
      }
    } catch (error) {
      debugError('Error loading data:', error);
      setUsers([]);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAccess = async () => {
    if (!selectedUserId) {
      toast({
        title: 'Error',
        description: 'Please select a user',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);

    try {
      const selectedUser = users.find(u => u.id === selectedUserId);
      if (!selectedUser) {
        throw new Error('User not found');
      }

      debugLog('PickUserSelection: Creating session for user:', selectedUser);

      // Create session
      userSessionManager.createSession(
        selectedUser.id,
        selectedUser.name,
        poolId,
        '' // Empty access code since we no longer use them
      );

      toast({
        title: 'Access Granted',
        description: `Welcome, ${selectedUser.name}!`,
      });

      onUserSelected(selectedUser.id, selectedUser.name);
    } catch (error) {
      debugError('Error verifying access:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify access',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const cardBase: React.CSSProperties = {
    background: card,
    border: `1px solid ${border}`,
    borderRadius: 10,
    padding: '1.5rem',
  };

  const loadingPulse = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ height: 14, background: border, borderRadius: 4, width: '75%', opacity: 0.6 }} />
      <div style={{ height: 14, background: border, borderRadius: 4, width: '50%', opacity: 0.6 }} />
    </div>
  );

  // Don't render until mounted to prevent hydration errors
  if (!isMounted) {
    return (
      <div style={cardBase}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Select Your Name</p>
        <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1rem' }}>Loading...</p>
        {loadingPulse}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={cardBase}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Select Your Name</p>
        <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1rem' }}>Loading users...</p>
        {loadingPulse}
      </div>
    );
  }

  if (users.length === 0) {
    // For playoffs, check if there are users who need to submit confidence points
    const isPlayoffs = seasonType === 3;
    const hasUsersNeedingConfidencePoints = usersNeedingConfidencePoints !== undefined && usersNeedingConfidencePoints > 0;

    if (isPlayoffs && hasUsersNeedingConfidencePoints) {
      return (
        <div style={cardBase}>
          <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Confidence Points Required</p>
          <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.25rem' }}>
            Participants need to submit confidence points before making picks
          </p>
          <div style={{ textAlign: 'center' }}>
            <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1rem' }}>
              There {usersNeedingConfidencePoints === 1 ? 'is' : 'are'} still {usersNeedingConfidencePoints} participant{usersNeedingConfidencePoints !== 1 ? 's' : ''} who need{usersNeedingConfidencePoints === 1 ? 's' : ''} to submit {usersNeedingConfidencePoints === 1 ? 'their' : 'their'} playoff confidence points before {usersNeedingConfidencePoints === 1 ? 'they can' : 'they can'} make picks.
            </p>
            <div style={{ background: 'oklch(72% 0.16 60 / 0.08)', border: `1px solid oklch(72% 0.16 60 / 0.3)`, borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ ...b, fontSize: '0.8rem', color: amber, marginBottom: '0.75rem' }}>
                <strong>Action Required:</strong> Participants must submit their playoff confidence points before they can make picks for playoff rounds.
              </p>
              <button
                onClick={() => router.push(`/pool/${poolId}/playoffs`)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  width: '100%', padding: '0.55rem 1rem',
                  background: 'transparent', color: amber,
                  border: `1px solid oklch(72% 0.16 60 / 0.4)`, borderRadius: 6,
                  ...bc, fontWeight: 700, fontSize: '0.78rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                <Target style={{ width: 14, height: 14 }} />
                Go to Confidence Points Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    // If all participants have submitted and we have a valid week, show the leaderboard
    if (currentWeek) {
      const weekLabel = isPlayoffs ? `Round ${currentWeek}` : `Week ${currentWeek}`;
      return (
        <div style={cardBase}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Trophy style={{ width: 18, height: 18, color: gold }} />
            <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase' }}>All Participants Submitted</p>
          </div>
          <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.25rem' }}>
            All participants have submitted their picks for {weekLabel}. View the leaderboard below.
          </p>
          <Leaderboard
            poolId={poolId}
            weekNumber={currentWeek}
            seasonType={seasonType || 2}
            season={poolSeason}
          />
        </div>
      );
    }

    // No participants in pool
    return (
      <div style={cardBase}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.25rem' }}>No Participants Available</p>
        <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.25rem' }}>
          No participants found in this pool
        </p>
        <div style={{ textAlign: 'center' }}>
          <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1rem' }}>
            No participants have been added to this pool yet.
          </p>
          <div style={{ background: 'oklch(59% 0.15 155 / 0.08)', border: `1px solid oklch(46% 0.14 155 / 0.3)`, borderRadius: 8, padding: '1rem' }}>
            <p style={{ ...b, fontSize: '0.8rem', color: greenHi }}>
              <strong>Commissioner Action Required:</strong> The pool commissioner needs to add participants to this pool before picks can be made.
            </p>
            <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginTop: '0.5rem' }}>
              Please contact the pool commissioner or use the commissioner dashboard to add participants.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Safety check - ensure users is an array
  if (!Array.isArray(users)) {
    debugError('Users is not an array:', users);
    return (
      <div style={cardBase}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Error Loading Participants</p>
        <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1rem' }}>There was an error loading the participant list.</p>
        <div style={{ textAlign: 'center' }}>
          <p style={{ ...b, fontSize: '0.875rem', color: 'oklch(62% 0.22 25)' }}>
            Failed to load participants. Please refresh the page and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={cardBase}>
      <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Select Your Name</p>
      <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.25rem' }}>
        {`Choose your name to make your picks for ${getWeekTitle(currentWeek, seasonType || 2)}`}
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="user-select" style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
          Your Name
        </label>
        <select
          id="user-select"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          style={{
            width: '100%',
            padding: '0.55rem 0.75rem',
            background: surface,
            color: selectedUserId ? text : textDim,
            border: `1px solid ${border}`,
            borderRadius: 6,
            ...b,
            fontSize: '0.875rem',
            outline: 'none',
            cursor: 'pointer',
            appearance: 'none',
            WebkitAppearance: 'none',
          }}
        >
          <option value="" style={{ background: surface, color: textDim }}>Select your name...</option>
          {users.map((user) => (
            <option key={user.id} value={user.id} style={{ background: surface, color: text }}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleVerifyAccess}
        disabled={!selectedUserId || isVerifying}
        style={{
          width: '100%',
          padding: '0.6rem 1rem',
          background: !selectedUserId || isVerifying ? border : green,
          color: !selectedUserId || isVerifying ? textDim : text,
          border: 'none',
          borderRadius: 6,
          ...bc,
          fontWeight: 700,
          fontSize: '0.8rem',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          cursor: !selectedUserId || isVerifying ? 'not-allowed' : 'pointer',
          opacity: !selectedUserId || isVerifying ? 0.6 : 1,
          transition: 'background 0.15s',
        }}
      >
        {isVerifying ? 'Verifying...' : 'Continue'}
      </button>
    </div>
  );
}
