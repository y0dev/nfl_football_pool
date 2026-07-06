'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { ArrowLeft, Mail, Users, Clock, AlertTriangle, CheckCircle, RefreshCw, Send, Filter, Search, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { loadPools } from '@/actions/loadPools';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createMailtoUrl, openEmailClient, copyMailtoToClipboard, createSubmissionSummaryEmail } from '@/lib/mailto-utils';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { debugLog, debugError} from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';

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
const purple  = 'oklch(65% 0.12 290)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface Participant {
  id: string;
  name: string;
  email: string;
  pool_id: string;
  pool_name: string;
  is_active: boolean;
  created_at: string;
  has_submitted: boolean;
  last_reminder_sent?: string;
}

interface Pool {
  id: string;
  name: string;
  is_active: boolean;
}

function RemindersContent() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [filterSubmitted, setFilterSubmitted] = useState<'all' | 'submitted' | 'not_submitted'>('not_submitted');
  const [isSendingSummary, setIsSendingSummary] = useState(false);
  const [summaryEmail, setSummaryEmail] = useState('');

  debugLog('RemindersContent rendering with:', { user, isLoading, currentWeek, currentSeasonType });

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        if (user) {
          debugLog('Checking admin status for user:', user.email);
          const superAdminStatus = user.is_super_admin;
          if (!superAdminStatus) {
            router.push('/dashboard');
            return;
          }
          await loadData();
        }
      } catch (error) {
        debugError('Error checking admin status:', error);
      }
    };
    if (user) checkAdminStatus();
  }, [user, router]);

  useEffect(() => {
    if (currentWeek && currentSeasonType && pools.length > 0) {
      loadParticipants();
    }
  }, [currentWeek, currentSeasonType, selectedPool, pools.length]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const weekData = await loadCurrentWeek();
      setCurrentWeek(weekData?.week_number || 1);
      setCurrentSeasonType(weekData?.season_type || 2);
      await loadPoolsData();
      await loadParticipants();
    } catch (error) {
      debugError('Error loading data:', error);
      toast({ title: 'Error', description: 'Failed to load reminder data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPoolsData = async () => {
    try {
      const poolsData = await loadPools(user?.email, user?.is_super_admin);
      setPools(poolsData);
    } catch (error) {
      debugError('Error loading pools:', error);
    }
  };

  const loadParticipants = async () => {
    try {
      const params = new URLSearchParams({
        week: String(currentWeek),
        seasonType: String(currentSeasonType),
        poolId: selectedPool,
        adminEmail: user?.email || '',
        isSuperAdmin: String(user?.is_super_admin || false),
      });
      const res = await fetch(`/api/admin/reminders/participants?${params}`);
      if (!res.ok) throw new Error('Failed to load participants');
      const data = await res.json();
      if (data.success) setParticipants(data.participants);
      else throw new Error(data.error);
    } catch (error) {
      debugError('Error loading participants:', error);
    }
  };

  const filteredParticipants = participants.filter(participant => {
    const matchesSearch = searchTerm === '' ||
      participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.pool_name.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesSubmissionFilter = true;
    if (filterSubmitted === 'submitted') matchesSubmissionFilter = participant.has_submitted;
    else if (filterSubmitted === 'not_submitted') matchesSubmissionFilter = !participant.has_submitted;

    return matchesSearch && matchesSubmissionFilter;
  });

  const handleSelectAll = () => {
    const notSubmittedParticipants = filteredParticipants.filter(p => !p.has_submitted);
    if (selectedParticipants.size === notSubmittedParticipants.length) {
      setSelectedParticipants(new Set());
    } else {
      setSelectedParticipants(new Set(notSubmittedParticipants.map(p => p.id)));
    }
  };

  const handleSelectParticipant = (participantId: string) => {
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(participantId)) newSelected.delete(participantId);
    else newSelected.add(participantId);
    setSelectedParticipants(newSelected);
  };

  const sendReminders = async () => {
    if (selectedParticipants.size === 0) {
      toast({ title: 'No Participants Selected', description: 'Please select at least one participant to send reminders to', variant: 'destructive' });
      return;
    }
    setIsSendingReminders(true);
    try {
      const response = await fetch('/api/admin/send-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': user?.email ?? '' },
        body: JSON.stringify({
          participantIds: Array.from(selectedParticipants),
          week: currentWeek,
          seasonType: currentSeasonType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const { successful, failed } = data.results;
        toast({
          title: 'Reminders Sent',
          description: `Sent ${successful} reminder${successful !== 1 ? 's' : ''}${failed > 0 ? `. ${failed} failed — check SMTP configuration.` : '.'}`,
        });
        setSelectedParticipants(new Set());
        await loadParticipants();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to send reminders', variant: 'destructive' });
      }
    } catch (error) {
      debugError('Error sending reminders:', error);
      toast({ title: 'Error', description: 'Failed to send reminders', variant: 'destructive' });
    } finally {
      setIsSendingReminders(false);
      setShowConfirmDialog(false);
    }
  };

  const sendSubmissionSummary = async () => {
    if (!summaryEmail.trim()) {
      toast({ title: 'Email Required', description: 'Please enter an email address to send the summary to', variant: 'destructive' });
      return;
    }
    setIsSendingSummary(true);
    try {
      const submittedParticipants = participants.filter(p => p.has_submitted);
      const notSubmittedParticipants = participants.filter(p => !p.has_submitted);
      const poolName = pools.find(p => p.id === selectedPool)?.name || 'NFL Pool';
      const emailOptions = createSubmissionSummaryEmail(poolName, currentWeek, participants.length, submittedParticipants.length, submittedParticipants, notSubmittedParticipants);
      emailOptions.to = summaryEmail;
      const mailtoUrl = createMailtoUrl(emailOptions);
      const opened = await openEmailClient(mailtoUrl);

      if (opened) {
        toast({ title: 'Email Client Opened', description: `Submission summary prepared and sent to ${summaryEmail}. Your email client should open automatically.` });
      } else {
        const copied = await copyMailtoToClipboard(mailtoUrl);
        if (copied) {
          toast({ title: 'Email URL Copied', description: 'Email URL copied to clipboard. Paste it in your browser address bar to open your email client.' });
        } else {
          toast({ title: 'Manual Action Required', description: `Please copy this URL and paste it in your browser: ${mailtoUrl}`, variant: 'destructive' });
        }
      }
      setSummaryEmail('');
    } catch (error) {
      debugError('Error preparing summary:', error);
      toast({ title: 'Error', description: 'Failed to prepare summary', variant: 'destructive' });
    } finally {
      setIsSendingSummary(false);
    }
  };

  const getStats = () => {
    const total = participants.length;
    const submitted = participants.filter(p => p.has_submitted).length;
    const notSubmitted = total - submitted;
    const selected = selectedParticipants.size;
    return { total, submitted, notSubmitted, selected };
  };

  const stats = getStats();
  const notSubmittedCount = filteredParticipants.filter(p => !p.has_submitted).length;

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading reminders…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Loading user…</p>
      </div>
    );
  }

  const labelStyle = {
    ...bc, fontSize: '0.68rem', fontWeight: 700 as const,
    letterSpacing: '0.08em', color: textDim,
    textTransform: 'uppercase' as const,
    display: 'block', marginBottom: '0.4rem',
  };

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'oklch(13% 0.025 255 / 0.95)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
      }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <button
                onClick={() => router.push('/admin/dashboard')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.6rem',
                  background: 'transparent', color: textMid,
                  border: `1px solid ${border}`, borderRadius: 5,
                  ...bc, fontWeight: 600, fontSize: '0.72rem',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <ArrowLeft style={{ width: 12, height: 12 }} />
                <span className="pools-nav-label">Dashboard</span>
              </button>
              <div style={{ width: 1, height: 20, background: border, flexShrink: 0 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Send Reminders
                </span>
              </div>
            </div>
            <button
              onClick={loadData}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.7rem',
                background: 'transparent', color: textMid,
                border: `1px solid ${border}`, borderRadius: 5,
                ...bc, fontWeight: 600, fontSize: '0.72rem',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <RefreshCw style={{ width: 11, height: 11 }} />
              <span className="pools-nav-label">Refresh</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(2.5rem, 5vw, 4rem) 0',
      }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            Week {currentWeek} · Email Outreach
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Pick<br /><span style={{ color: gold }}>Reminders</span>
          </h1>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid, maxWidth: '44ch' }}>
            Send email reminders to participants who haven&apos;t submitted their picks for Week {currentWeek}.
          </p>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── STATS ── */}
      <section style={{ background: surface, padding: '2.5rem 0' }}>
        <div className="lp-inner">
          <div className="admin-week-grid">
            {[
              { label: 'Total', value: stats.total, icon: Users, color: greenHi },
              { label: 'Pools', value: pools.length, icon: Filter, color: textMid },
              { label: 'Submitted', value: stats.submitted, icon: CheckCircle, color: greenHi },
              { label: 'Need Reminder', value: stats.notSubmitted, icon: AlertTriangle, color: amber },
              { label: 'Selected', value: stats.selected, icon: Mail, color: purple },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{
                background: card,
                border: `1px solid ${border}`,
                borderRadius: 8,
                padding: '1.25rem',
                textAlign: 'center' as const,
              }}>
                <Icon style={{ width: 20, height: 20, color, margin: '0 auto 0.5rem' }} />
                <div style={{ ...bc, fontWeight: 900, fontSize: '1.75rem', color, lineHeight: 1 }}>{value}</div>
                <div style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase' as const, marginTop: '0.25rem' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FILTERS ── */}
      <section style={{ background: bg, padding: '2.5rem 0' }}>
        <div className="lp-inner">
          <div style={{
            background: card,
            border: `1px solid ${border}`,
            borderLeft: `3px solid ${green}`,
            borderRadius: 8,
            padding: '1.75rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Filter style={{ width: 16, height: 16, color: greenHi }} />
              <h2 style={{ ...bc, fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                Filters &amp; Actions
              </h2>
            </div>

            <div className="admin-stats-grid" style={{ marginBottom: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Pool</label>
                <Select value={selectedPool} onValueChange={setSelectedPool}>
                  <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text }}>
                    <SelectValue placeholder="Select pool" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pools</SelectItem>
                    {pools.map((pool) => (
                      <SelectItem key={pool.id} value={pool.id}>{pool.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label style={labelStyle}>Status</label>
                <Select value={filterSubmitted} onValueChange={(value: 'all' | 'submitted' | 'not_submitted') => setFilterSubmitted(value)}>
                  <SelectTrigger style={{ background: surface, border: `1px solid ${border}`, color: text }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Participants</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="not_submitted">Not Submitted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label style={labelStyle}>Search</label>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: textDim }} />
                  <Input
                    placeholder="Search participants…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ background: surface, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.88rem', paddingLeft: '2.25rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={handleSelectAll}
                  style={{
                    width: '100%',
                    padding: '0.5rem 1rem',
                    background: 'transparent', color: textMid,
                    border: `1px solid ${border}`, borderRadius: 6,
                    ...bc, fontWeight: 600, fontSize: '0.78rem',
                    letterSpacing: '0.07em', textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {selectedParticipants.size === notSubmittedCount ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {/* Send Reminders Banner */}
            {stats.selected > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                background: 'oklch(46% 0.14 155 / 0.12)',
                border: `1px solid oklch(46% 0.14 155 / 0.4)`,
                borderRadius: 6,
                marginBottom: '0.75rem',
                flexWrap: 'wrap', gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail style={{ width: 16, height: 16, color: greenHi }} />
                  <span style={{ ...b, fontSize: '0.875rem', color: greenHi, fontWeight: 600 }}>
                    {stats.selected} participant{stats.selected !== 1 ? 's' : ''} selected for reminders
                  </span>
                </div>
                <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                  <AlertDialogTrigger asChild>
                    <button
                      onClick={() => setShowConfirmDialog(true)}
                      disabled={isSendingReminders}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.45rem 0.9rem',
                        background: green, color: text,
                        border: 'none', borderRadius: 6,
                        ...bc, fontWeight: 700, fontSize: '0.78rem',
                        letterSpacing: '0.07em', textTransform: 'uppercase',
                        cursor: isSendingReminders ? 'not-allowed' : 'pointer',
                        opacity: isSendingReminders ? 0.6 : 1,
                      }}
                    >
                      <Send style={{ width: 12, height: 12 }} />
                      {isSendingReminders ? 'Sending…' : 'Send Reminders'}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Send Reminders</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to send reminder emails to {stats.selected} participant{stats.selected !== 1 ? 's' : ''}?
                        This will notify them that they haven&apos;t submitted their picks for Week {currentWeek}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={sendReminders}>Send Reminders</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Summary Email */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.85rem 1rem',
              background: 'oklch(46% 0.14 155 / 0.07)',
              border: `1px solid ${border}`,
              borderRadius: 6,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 160 }}>
                <BarChart3 style={{ width: 16, height: 16, color: textMid }} />
                <span style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', color: textMid, textTransform: 'uppercase' }}>
                  Send Submission Summary
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Input
                  type="email"
                  placeholder="Email address"
                  value={summaryEmail}
                  onChange={(e) => setSummaryEmail(e.target.value)}
                  style={{ background: surface, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.85rem', width: 220 }}
                />
                <button
                  onClick={sendSubmissionSummary}
                  disabled={isSendingSummary || !summaryEmail.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    background: isSendingSummary || !summaryEmail.trim() ? 'oklch(26% 0.03 255)' : surface,
                    color: isSendingSummary || !summaryEmail.trim() ? textDim : textMid,
                    border: `1px solid ${border}`, borderRadius: 6,
                    ...bc, fontWeight: 600, fontSize: '0.75rem',
                    letterSpacing: '0.07em', textTransform: 'uppercase',
                    cursor: isSendingSummary || !summaryEmail.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  <BarChart3 style={{ width: 12, height: 12 }} />
                  {isSendingSummary ? 'Sending…' : 'Send Summary'}
                </button>
              </div>
            </div>
          </div>

          {/* ── PARTICIPANT LIST ── */}
          <div style={{
            background: card,
            border: `1px solid ${border}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {/* List Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '1rem 1.25rem',
              borderBottom: `1px solid ${border}`,
              background: surface,
            }}>
              <Users style={{ width: 15, height: 15, color: greenHi }} />
              <span style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                Participants
              </span>
              <span style={{
                ...bc, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em',
                color: textDim, background: border,
                padding: '0.1rem 0.45rem', borderRadius: 4,
              }}>
                {filteredParticipants.length}
              </span>
              <span style={{ ...b, fontSize: '0.75rem', color: textDim, marginLeft: 'auto' }}>
                Select participants to send reminder emails
              </span>
            </div>

            {/* List Body */}
            <div style={{ padding: '0.75rem' }}>
              {filteredParticipants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <Users style={{ width: 40, height: 40, color: textDim, margin: '0 auto 0.75rem' }} />
                  <p style={{ ...b, fontSize: '0.875rem', color: textMid }}>No participants found matching your filters</p>
                  {participants.length > 0 && (
                    <p style={{ ...b, fontSize: '0.78rem', color: textDim, marginTop: '0.35rem' }}>Try adjusting your search or filter criteria</p>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {filteredParticipants.map((participant) => {
                    const submitted = participant.has_submitted;
                    return (
                      <div
                        key={participant.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.85rem 1rem',
                          background: submitted ? 'oklch(46% 0.14 155 / 0.07)' : 'oklch(72% 0.16 60 / 0.07)',
                          border: `1px solid ${submitted ? 'oklch(46% 0.14 155 / 0.3)' : 'oklch(72% 0.16 60 / 0.3)'}`,
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                          <Checkbox
                            checked={selectedParticipants.has(participant.id)}
                            onCheckedChange={() => handleSelectParticipant(participant.id)}
                            disabled={submitted}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                              <span style={{ ...bc, fontWeight: 700, fontSize: '0.88rem', color: text }}>{participant.name}</span>
                              <span style={{
                                ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em',
                                padding: '0.1rem 0.4rem', borderRadius: 4, textTransform: 'uppercase',
                                background: submitted ? 'oklch(46% 0.14 155 / 0.25)' : 'oklch(72% 0.16 60 / 0.25)',
                                color: submitted ? greenHi : amber,
                              }}>
                                {submitted ? 'Submitted' : 'Not Submitted'}
                              </span>
                            </div>
                            <p style={{ ...b, fontSize: '0.78rem', color: textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{participant.email}</p>
                            <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>Pool: {participant.pool_name}</p>
                            {participant.last_reminder_sent && (
                              <p style={{ ...b, fontSize: '0.72rem', color: textDim }}>
                                Last reminder: {new Date(participant.last_reminder_sent).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div style={{ paddingLeft: '0.5rem', flexShrink: 0 }}>
                          {submitted
                            ? <CheckCircle style={{ width: 18, height: 18, color: greenHi }} />
                            : <Clock style={{ width: 18, height: 18, color: amber }} />
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer pageName="Commissioner HQ" />
    </div>
  );
}

export default function RemindersPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <RemindersContent />
      </AdminGuard>
    </AuthProvider>
  );
}
