'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, Link as LinkIcon, QrCode } from 'lucide-react';
import { getUpcomingWeek } from '@/actions/loadCurrentWeek';

const card    = 'oklch(20% 0.03 255)';
const surface = 'oklch(17% 0.028 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const blue    = 'oklch(65% 0.15 250)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const cardStyle = { background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' };
const labelStyle = { ...bc, fontSize: '0.68rem', fontWeight: 700 as const, color: textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' };

interface ParticipantLinksProps {
  poolId: string;
  poolName: string;
  weekNumber?: number;
  seasonType?: number;
  seasonScope?: number[];
}

export function ParticipantLinks({ poolId, poolName, weekNumber, seasonType, seasonScope }: ParticipantLinksProps) {
  const scope = seasonScope && seasonScope.length > 0 ? [...seasonScope].sort((a, b) => a - b) : [2];
  const clampToScope = (st: number) => scope.includes(st) ? st : scope[0];

  const [currentWeek, setCurrentWeek] = useState<number>(weekNumber || 1);
  const [currentSeasonType, setCurrentSeasonType] = useState<number>(clampToScope(seasonType || 2));
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateParticipantLink = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/pool/${poolId}/picks?week=${currentWeek}&seasonType=${currentSeasonType}`;
  };

  const copyLink = async () => {
    const link = generateParticipantLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: 'Link Copied', description: 'Participant link copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Error', description: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const shareLink = async () => {
    const link = generateParticipantLink();
    const weekLabel = currentSeasonType === 3 ? `Round ${currentWeek}` : `Week ${currentWeek}`;
    const text = `Join ${poolName} — ${weekLabel} Sunday Huddle: ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${poolName} - ${weekLabel}`, text, url: link });
      } catch { /* share cancelled */ }
    } else {
      copyLink();
    }
  };

  useEffect(() => {
    const loadWeek = async () => {
      try {
        const weekData = await getUpcomingWeek();
        const clamped = clampToScope(weekData.seasonType);
        setCurrentWeek(weekData.week);
        setCurrentSeasonType(clamped);
      } catch (error) {
        console.error('Error loading current week:', error);
      }
    };
    loadWeek();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const participantLink = generateParticipantLink();
  const weekLabel = currentSeasonType === 3 ? `Round ${currentWeek}` : `Week ${currentWeek}`;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
        <LinkIcon style={{ width: 14, height: 14, color: textMid }} />
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Participant Links</p>
      </div>
      <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1.25rem' }}>Generate and share links for participants to join your pool</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Pool + Week info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Pool</label>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: textMid, padding: '0.25rem 0.6rem', background: surface, border: `1px solid ${border}`, borderRadius: 20 }}>{poolName}</span>
          </div>
          <div>
            <label style={labelStyle}>{currentSeasonType === 3 ? 'Round' : 'Week'}</label>
            <span style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: textMid, padding: '0.25rem 0.6rem', background: 'transparent', border: `1px solid ${border}`, borderRadius: 20 }}>{weekLabel}</span>
          </div>
        </div>

        {/* Link */}
        <div>
          <label style={labelStyle}>Participant Link</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={participantLink}
              readOnly
              style={{ flex: 1, ...b, background: surface, border: `1px solid ${border}`, color: textMid, padding: '0.45rem 0.75rem', borderRadius: 6, fontSize: '0.8rem', boxSizing: 'border-box' as const }}
            />
            <button
              onClick={copyLink}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.75rem', background: 'transparent', color: copied ? greenHi : textMid, border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' as const }}
            >
              <Copy style={{ width: 12, height: 12 }} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={shareLink}
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.55rem', background: green, color: text, border: 'none', borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            <Share2 style={{ width: 13, height: 13 }} />
            Share Link
          </button>
          <button
            onClick={() => window.open(participantLink, '_blank')}
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.55rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            <QrCode style={{ width: 13, height: 13 }} />
            Preview Link
          </button>
        </div>

        {/* Instructions */}
        <div style={{ padding: '0.85rem 1rem', background: `color-mix(in oklch, ${blue} 7%, ${surface})`, border: `1px solid color-mix(in oklch, ${blue} 22%, ${border})`, borderRadius: 6 }}>
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.75rem', color: blue, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>How to use</p>
          <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {[
              'Copy or share the participant link above',
              'Send it to your pool participants via text, email, or messaging',
              'Participants can click the link to access the pool directly',
              'The link includes the pool ID and current week automatically',
            ].map((item, i) => (
              <li key={i} style={{ listStyleType: 'decimal', ...b, fontSize: '0.78rem', color: textMid }}>{item}</li>
            ))}
          </ol>
        </div>

        {/* Quick Share */}
        <div>
          <label style={labelStyle}>Quick Share</label>
          <button
            onClick={() => {
              const subject = `${poolName} — ${weekLabel} NFL Pool`;
              const body = `Join our Sunday Huddle for ${weekLabel}!\n\nClick this link to participate: ${participantLink}`;
              window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, cursor: 'pointer', ...bc, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            📧 Email
          </button>
        </div>
      </div>
    </div>
  );
}
