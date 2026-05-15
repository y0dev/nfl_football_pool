'use client';

import { useState, useEffect } from 'react';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { getUsersWhoSubmitted } from '@/actions/checkUserSubmission';
import { loadUsers } from '@/actions/loadUsers';
import { CheckCircle, Clock, Users } from 'lucide-react';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const amber   = 'oklch(72% 0.16 60)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface SubmissionStatusProps {
  poolId: string;
  seasonType?: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export function SubmissionStatus({ poolId, seasonType = 2 }: SubmissionStatusProps) {
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [currentSeasonType, setCurrentSeasonType] = useState<number>(seasonType);
  const [submittedUsers, setSubmittedUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const { week, seasonType } = await getUpcomingWeek();
        setCurrentWeek(week);
        setCurrentSeasonType(seasonType);
        if (week) {
          const submittedIds = await getUsersWhoSubmitted(poolId, week, seasonType);
          setSubmittedUsers(submittedIds);
          const allUsersData = await loadUsers(poolId);
          setAllUsers(allUsersData);
        }
      } catch (error) {
        console.error('Error loading submission status:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [poolId]);

  const cardStyle = { background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' };

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <Users style={{ width: 28, height: 28, color: textDim, margin: '0 auto 0.5rem', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>Loading submission status...</p>
        </div>
      </div>
    );
  }

  if (!currentWeek) {
    return (
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <Clock style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem' }} />
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', marginBottom: '0.35rem' }}>No Active Week</p>
          <p style={{ ...b, fontSize: '0.8rem', color: textDim }}>There is no active week for submissions at this time.</p>
        </div>
      </div>
    );
  }

  const submittedCount = submittedUsers.length;
  const totalCount = allUsers.length;
  const pendingCount = totalCount - submittedCount;
  const submissionRate = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;
  const submittedUserNames = allUsers.filter(u => submittedUsers.includes(u.id)).map(u => u.name);
  const pendingUserNames = allUsers.filter(u => !submittedUsers.includes(u.id)).map(u => u.name);

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
        <Users style={{ width: 16, height: 16, color: textMid }} />
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Week {currentWeek} Submission Status</p>
      </div>
      <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1.25rem' }}>Track which participants have submitted their picks</p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1rem' }}>
        {[
          { label: 'Submitted', value: submittedCount, color: greenHi },
          { label: 'Pending', value: pendingCount, color: amber },
          { label: 'Complete', value: `${submissionRate}%`, color: textMid },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center', padding: '0.75rem', background: surface, border: `1px solid ${border}`, borderRadius: 6 }}>
            <p style={{ ...bc, fontWeight: 900, fontSize: '1.4rem', color, lineHeight: 1 }}>{value}</p>
            <p style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.2rem' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
          <span style={{ ...b, fontSize: '0.75rem', color: textMid }}>Submission Progress</span>
          <span style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: textMid }}>{submittedCount}/{totalCount}</span>
        </div>
        <div style={{ width: '100%', background: surface, borderRadius: 999, height: 6, border: `1px solid ${border}` }}>
          <div style={{ height: '100%', borderRadius: 999, background: green, width: `${submissionRate}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Submitted names */}
      {submittedUserNames.length > 0 && (
        <div style={{ marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <CheckCircle style={{ width: 13, height: 13, color: greenHi }} />
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', color: greenHi, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Submitted ({submittedUserNames.length})</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {submittedUserNames.map((name, i) => (
              <span key={i} style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', padding: '0.15rem 0.5rem', background: `color-mix(in oklch, ${greenHi} 12%, ${surface})`, color: greenHi, border: `1px solid color-mix(in oklch, ${greenHi} 35%, ${border})`, borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Pending names */}
      {pendingUserNames.length > 0 && (
        <div style={{ marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <Clock style={{ width: 13, height: 13, color: amber }} />
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', color: amber, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pending ({pendingUserNames.length})</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {pendingUserNames.map((name, i) => (
              <span key={i} style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', padding: '0.15rem 0.5rem', background: `color-mix(in oklch, ${amber} 10%, ${surface})`, color: amber, border: `1px solid color-mix(in oklch, ${amber} 30%, ${border})`, borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{name}</span>
            ))}
          </div>
        </div>
      )}

      {/* All submitted */}
      {submittedCount === totalCount && totalCount > 0 && (
        <div style={{ textAlign: 'center', padding: '0.85rem', background: `color-mix(in oklch, ${greenHi} 8%, ${surface})`, border: `1px solid color-mix(in oklch, ${greenHi} 25%, ${border})`, borderRadius: 8 }}>
          <CheckCircle style={{ width: 24, height: 24, color: greenHi, margin: '0 auto 0.5rem' }} />
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: greenHi, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>All Picks Submitted!</p>
          <p style={{ ...b, fontSize: '0.75rem', color: textDim }}>All {totalCount} participants have submitted their picks for Week {currentWeek}.</p>
        </div>
      )}
    </div>
  );
}
