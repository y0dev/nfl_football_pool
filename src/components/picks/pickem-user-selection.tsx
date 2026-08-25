'use client';

// Pick'em's equivalent of pick-user-selection.tsx's PickUserSelection —
// same "Select Your Name" card, same "Your Name" label + dropdown +
// disabled-until-selected "Continue" button, same "All Participants
// Submitted" empty state once nobody's left to pick. Deliberately NOT a
// reuse of PickUserSelection itself: that component's own data source
// (loadUsers/getUsersWhoSubmitted, src/actions/) queries the `picks` table
// directly and has no concept of Pick'em's pickem_picks-backed
// PickemWeekResult, so wiring it in would mean teaching a Confidence-only
// action about a different pool type's schema. This component is handed
// the already-loaded result data pickem-picks-content.tsx has anyway (no
// second fetch), and defers to the caller's existing handleSelectParticipant
// for session creation — matching the same net behavior with one clear
// data source instead of two racing ones.

import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { getWeekTitle } from '@/lib/utils';
import { PickemStandingsPanel } from '@/components/leaderboard/pickem-leaderboard';

const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const cardBase: React.CSSProperties = {
  background: card,
  border: `1px solid ${border}`,
  borderRadius: 10,
  padding: '1.5rem',
};

interface PickemUserSelectionProps {
  poolId: string;
  week: number;
  seasonType: number;
  /** Every participant in the pool, regardless of submission status — used
   * only to distinguish "nobody's been added yet" from "everyone's already
   * submitted" for the empty-state copy. */
  totalParticipantCount: number;
  /** Participants who have NOT yet submitted a complete set of picks —
   * exactly loadUsers()'s "available" filtering, computed by the caller
   * from PickemWeekResult.participants[].isComplete. */
  availableParticipants: { participantId: string; participantName: string }[];
  onUserSelected: (id: string) => void;
}

export function PickemUserSelection({ poolId, week, seasonType, totalParticipantCount, availableParticipants, onUserSelected }: PickemUserSelectionProps) {
  const [selectedId, setSelectedId] = useState('');

  if (totalParticipantCount === 0) {
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

  if (availableParticipants.length === 0) {
    return (
      <div style={cardBase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <Trophy style={{ width: 18, height: 18, color: gold }} />
          <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase' }}>All Participants Submitted</p>
        </div>
        <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.25rem' }}>
          All participants have submitted their picks for {getWeekTitle(week, seasonType)}. View the leaderboard below.
        </p>
        <PickemStandingsPanel poolId={poolId} />
      </div>
    );
  }

  return (
    <div style={cardBase}>
      <p style={{ ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Select Your Name</p>
      <p style={{ ...b, fontSize: '0.8rem', color: textDim, marginBottom: '1.25rem' }}>
        {`Choose your name to make your picks for ${getWeekTitle(week, seasonType)}`}
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="pickem-user-select" style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
          Your Name
        </label>
        <select
          id="pickem-user-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{
            width: '100%',
            padding: '0.55rem 0.75rem',
            background: surface,
            color: selectedId ? text : textDim,
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
          {availableParticipants.map((p) => (
            <option key={p.participantId} value={p.participantId} style={{ background: surface, color: text }}>
              {p.participantName}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => selectedId && onUserSelected(selectedId)}
        disabled={!selectedId}
        style={{
          width: '100%',
          padding: '0.6rem 1rem',
          background: !selectedId ? border : green,
          color: !selectedId ? textDim : text,
          border: 'none',
          borderRadius: 6,
          ...bc,
          fontWeight: 700,
          fontSize: '0.8rem',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          cursor: !selectedId ? 'not-allowed' : 'pointer',
          opacity: !selectedId ? 0.6 : 1,
          transition: 'background 0.15s',
        }}
      >
        Continue
      </button>
    </div>
  );
}
