'use client';

import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { sendPickReminders, getParticipantsWithoutPicks, testEmailConfiguration } from '@/actions/emailActions';

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

const cardStyle = { background: card, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' };
const labelStyle = { ...bc, fontSize: '0.68rem', fontWeight: 700 as const, color: textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' };
const inputStyle = { ...b, background: surface, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box' as const, fontSize: '0.875rem' };

interface EmailManagementProps {
  poolId: string;
  weekNumber: number;
  adminId: string;
  poolName: string;
}

export function EmailManagement({ poolId, weekNumber, adminId, poolName }: EmailManagementProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [deadline, setDeadline] = useState('Sunday at kickoff');
  const [customMessage, setCustomMessage] = useState('');
  const [participantsWithoutPicks, setParticipantsWithoutPicks] = useState<any[]>([]);
  const [emailStatus, setEmailStatus] = useState<{ sent: number; failed: number; total: number; message: string } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setIsMounted(true); }, []);

  const loadParticipantsWithoutPicks = async () => {
    try {
      const participants = await getParticipantsWithoutPicks(poolId, weekNumber);
      setParticipantsWithoutPicks(participants);
    } catch {
      toast({ title: 'Error', description: 'Failed to load participants', variant: 'destructive' });
    }
  };

  const handleSendReminders = async () => {
    setIsLoading(true);
    setEmailStatus(null);
    try {
      const result = await sendPickReminders({
        poolId, weekNumber, adminId, deadline,
        poolUrl: `${window.location.origin}/picks?pool=${poolId}&week=${weekNumber}`,
      });
      setEmailStatus({ sent: result.sent, failed: result.failed, total: result.total, message: result.message });
      if (result.success) {
        toast({ title: 'Reminders Sent', description: result.message });
        await loadParticipantsWithoutPicks();
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to send reminders', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTesting(true);
    try {
      const result = await testEmailConfiguration();
      if (result.success) toast({ title: 'Test Email Sent', description: result.message });
      else toast({ title: 'Test Failed', description: result.message, variant: 'destructive' });
    } catch {
      toast({ title: 'Error', description: 'Failed to send test email', variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    if (isMounted) loadParticipantsWithoutPicks();
  }, [isMounted, poolId, weekNumber]);

  if (!isMounted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={cardStyle}>
          <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📧 Email Reminders</p>
          <div style={{ marginTop: '0.85rem' }}>
            <div style={{ height: 12, background: surface, borderRadius: 4, marginBottom: '0.5rem', width: '75%' }} />
            <div style={{ height: 12, background: surface, borderRadius: 4, width: '50%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Reminders card */}
      <div style={cardStyle}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.9rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>📧 Email Reminders</p>
        <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>
          Send pick reminders to participants who haven&apos;t submitted picks for Week {weekNumber}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div>
            <label style={labelStyle}>Deadline</label>
            <input value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="e.g., Sunday at kickoff" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Custom Message (Optional)</label>
            <Textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Add a custom message..." rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleSendReminders} disabled={isLoading} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.55rem', background: isLoading ? border : green, color: isLoading ? textDim : text, border: 'none', borderRadius: 6, cursor: isLoading ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {isLoading ? 'Sending...' : `Send Reminders (${participantsWithoutPicks.length})`}
          </button>
          <button onClick={handleTestEmail} disabled={isTesting} style={{ display: 'inline-flex', alignItems: 'center', padding: '0.55rem 0.85rem', background: 'transparent', color: isTesting ? textDim : textMid, border: `1px solid ${border}`, borderRadius: 6, cursor: isTesting ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {isTesting ? 'Testing...' : 'Test Email'}
          </button>
        </div>

        {emailStatus && (
          <div style={{ marginTop: '0.85rem', padding: '0.75rem 1rem', background: `color-mix(in oklch, ${emailStatus.failed > 0 ? amber : greenHi} 10%, ${surface})`, border: `1px solid color-mix(in oklch, ${emailStatus.failed > 0 ? amber : greenHi} 30%, ${border})`, borderRadius: 6 }}>
            <p style={{ ...bc, fontWeight: 800, fontSize: '0.8rem', color: emailStatus.failed > 0 ? amber : greenHi, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
              {emailStatus.failed > 0 ? '⚠️ Sent with Errors' : '✅ Sent Successfully'}
            </p>
            <p style={{ ...b, fontSize: '0.8rem', color: textMid, marginBottom: '0.35rem' }}>{emailStatus.message}</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {[`📤 Sent: ${emailStatus.sent}`, `❌ Failed: ${emailStatus.failed}`, `📊 Total: ${emailStatus.total}`].map(s => (
                <span key={s} style={{ ...b, fontSize: '0.75rem', color: textDim }}>{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Participants without picks */}
      <div style={cardStyle}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>Participants Without Picks</p>
        <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '1rem' }}>Haven&apos;t submitted picks for Week {weekNumber}</p>
        {participantsWithoutPicks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.25rem' }}>
            <p style={{ ...b, fontSize: '0.85rem', color: greenHi }}>🎉 All participants have submitted their picks!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {participantsWithoutPicks.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: surface, border: `1px solid ${border}`, borderRadius: 6 }}>
                <div>
                  <p style={{ ...b, fontWeight: 600, fontSize: '0.875rem', color: text }}>{p.name}</p>
                  <p style={{ ...b, fontSize: '0.75rem', color: textDim }}>{p.email}</p>
                </div>
                <span style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.15rem 0.5rem', background: surface, border: `1px solid ${border}`, borderRadius: 4, color: textDim }}>No Picks</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email preview */}
      <div style={cardStyle}>
        <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>Email Template Preview</p>
        <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginBottom: '0.85rem' }}>This is what participants will receive</p>
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 6, padding: '0.85rem' }}>
          {[
            ['Subject', `🏈 Sunday Huddle — Week ${weekNumber} Picks Due!`],
            ['Recipients', `${participantsWithoutPicks.length} participants`],
            ['Pool', poolName],
            ['Week', String(weekNumber)],
            ['Deadline', deadline],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: '0.5rem', padding: '0.3rem 0', borderBottom: `1px solid ${border}` }}>
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em', minWidth: 80, flexShrink: 0 }}>{k}:</span>
              <span style={{ ...b, fontSize: '0.8rem', color: textMid }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
