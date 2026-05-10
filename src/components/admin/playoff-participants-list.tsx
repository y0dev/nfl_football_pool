'use client';

import { useState, useEffect } from 'react';
import { Users, CheckCircle2, XCircle, Target } from 'lucide-react';
import { loadUsers } from '@/actions/loadUsers';
import { PlayoffParticipantEditDialog } from './playoff-participant-edit-dialog';

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

interface PlayoffParticipantsListProps {
  poolId: string;
  poolSeason: number;
}

interface ParticipantStatus {
  id: string;
  name: string;
  hasSubmitted: boolean;
  submissionCount: number;
  totalTeams: number;
}

export function PlayoffParticipantsList({ poolId, poolSeason }: PlayoffParticipantsListProps) {
  const [participants, setParticipants] = useState<ParticipantStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantStatus | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => { loadParticipantStatus(); }, [poolId, poolSeason]);

  const loadParticipantStatus = async () => {
    try {
      setIsLoading(true);
      const allParticipants = await loadUsers(poolId);
      if (!allParticipants || allParticipants.length === 0) { setParticipants([]); return; }

      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();

      const { data: playoffTeams } = await supabase.from('playoff_teams').select('id').eq('season', poolSeason);
      const teamsCount = playoffTeams?.length || 0;

      const { data: confidenceSubmissions } = await supabase
        .from('playoff_confidence_points').select('participant_id')
        .eq('pool_id', poolId).eq('season', poolSeason);

      const counts = new Map<string, number>();
      confidenceSubmissions?.forEach(s => counts.set(s.participant_id, (counts.get(s.participant_id) || 0) + 1));

      const list: ParticipantStatus[] = allParticipants.map(p => ({
        id: p.id, name: p.name,
        submissionCount: counts.get(p.id) || 0,
        totalTeams: teamsCount,
        hasSubmitted: (counts.get(p.id) || 0) === teamsCount && teamsCount > 0,
      }));

      list.sort((a, b) => a.hasSubmitted !== b.hasSubmitted ? (a.hasSubmitted ? -1 : 1) : a.name.localeCompare(b.name));
      setParticipants(list);
    } catch (error) {
      console.error('Error loading participant status:', error);
      setParticipants([]);
    } finally {
      setIsLoading(false);
    }
  };

  const cardStyle = { background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: 28, height: 28, border: `2px solid ${border}`, borderTopColor: green, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Users style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
        <p style={{ ...b, fontSize: '0.85rem', color: textDim }}>No participants found in this pool</p>
      </div>
    );
  }

  const submittedCount = participants.filter(p => p.hasSubmitted).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        {[
          { label: 'Total', value: participants.length, icon: Users, color: textMid },
          { label: 'Submitted', value: submittedCount, icon: CheckCircle2, color: greenHi },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem' }}>
            <div>
              <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginBottom: '0.15rem' }}>{label}</p>
              <p style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', color, lineHeight: 1 }}>{value}</p>
            </div>
            <Icon style={{ width: 22, height: 22, color }} />
          </div>
        ))}
      </div>

      {/* Participants list */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
          <Target style={{ width: 14, height: 14, color: textMid }} />
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Participant Status</p>
        </div>
        <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>View which participants have submitted their playoff confidence points</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {participants.map((participant) => (
            <div
              key={participant.id}
              onClick={() => { setSelectedParticipant(participant); setDialogOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '0.7rem 0.85rem', background: surface, border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {participant.hasSubmitted
                  ? <CheckCircle2 style={{ width: 15, height: 15, color: greenHi, flexShrink: 0 }} />
                  : <XCircle style={{ width: 15, height: 15, color: amber, flexShrink: 0 }} />
                }
                <span style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{participant.name}</span>
              </div>
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.15rem 0.5rem', borderRadius: 4, border: `1px solid ${participant.hasSubmitted ? `color-mix(in oklch, ${greenHi} 35%, ${border})` : `color-mix(in oklch, ${amber} 35%, ${border})`}`, background: participant.hasSubmitted ? `color-mix(in oklch, ${greenHi} 10%, ${surface})` : `color-mix(in oklch, ${amber} 10%, ${surface})`, color: participant.hasSubmitted ? greenHi : amber }}>
                {participant.hasSubmitted ? 'Submitted' : `Pending (${participant.submissionCount}/${participant.totalTeams})`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {selectedParticipant && (
        <PlayoffParticipantEditDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          participantId={selectedParticipant.id}
          participantName={selectedParticipant.name}
          poolId={poolId}
          poolSeason={poolSeason}
          onUpdate={loadParticipantStatus}
        />
      )}
    </div>
  );
}
