'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { requestDeletionConfirmation } from '@/actions/accountDeletion';
import { requestEmailChange } from '@/actions/emailChange';
import { Footer } from '@/components/layout/Footer';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Eye, EyeOff, LogOut, Trash2, KeyRound, User, ArrowLeft, Mail, Info, CreditCard, Calendar, Save, Receipt, Plus, ShieldCheck, Link2, Unlink, Bell, Hash } from 'lucide-react';
import Link from 'next/link';
import { createPageUrl, getNFLSeasonYear, debugError } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { loadSeasonSettings, updateSeasonSettings } from '@/actions/seasonSettings';
import { PlanBadge } from '@/components/billing/plan-badge';
import type { SubscriptionSummary } from '@/lib/subscription';

type NotificationPreferences = {
  pick_reminders: boolean;
  weekly_summaries: boolean;
  season_announcements: boolean;
  product_updates: boolean;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pick_reminders: true,
  weekly_summaries: true,
  season_announcements: true,
  product_updates: true,
};

const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const errRed  = 'oklch(62% 0.22 25)';
const liveRed = 'oklch(62% 0.22 25)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const labelSt: React.CSSProperties = { ...bc, fontSize: '0.68rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' };
const inputSt: React.CSSProperties = { ...b, background: bg, border: `1px solid ${border}`, color: text, padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6, boxSizing: 'border-box', fontSize: '0.875rem' };
const cardSt: React.CSSProperties = { background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1.5rem' };
const sectionTitle: React.CSSProperties = { ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1.25rem' };

const SEASON_TYPES = [
  { value: 0, label: 'Offseason' },
  { value: 1, label: 'Preseason' },
  { value: 2, label: 'Regular Season' },
  { value: 3, label: 'Postseason' },
];

function PasswordInput({ value, onChange, placeholder, autoComplete }: { value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{ ...inputSt, paddingRight: '2.75rem' }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 0.75rem', background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        {show ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
      </button>
    </div>
  );
}

function AccountSettingsContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isOAuthAccount, setIsOAuthAccount] = useState<boolean | null>(null);

  // Season Settings (super-admin only, system-wide — folded in here instead
  // of its own /admin/season-settings page to keep the dashboard navbar lean)
  const [seasonYear, setSeasonYear] = useState(getNFLSeasonYear());
  const [seasonSettingsLoading, setSeasonSettingsLoading] = useState(true);
  const [seasonSettingsSaving, setSeasonSettingsSaving] = useState(false);
  const [preseasonStartDate, setPreseasonStartDate] = useState('');
  const [regularSeasonStartDate, setRegularSeasonStartDate] = useState('');
  const [postseasonStartDate, setPostseasonStartDate] = useState('');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(0);
  const [seasonOver, setSeasonOver] = useState(false);

  useEffect(() => {
    if (!user?.is_super_admin) return;
    let cancelled = false;
    setSeasonSettingsLoading(true);
    loadSeasonSettings(seasonYear)
      .then(settings => {
        if (cancelled) return;
        setPreseasonStartDate(settings.preseasonStartDate?.slice(0, 10) ?? '');
        setRegularSeasonStartDate(settings.regularSeasonStartDate?.slice(0, 10) ?? '');
        setPostseasonStartDate(settings.postseasonStartDate?.slice(0, 10) ?? '');
        setCurrentWeek(settings.currentWeek);
        setCurrentSeasonType(settings.currentSeasonType);
        setSeasonOver(settings.seasonOver);
      })
      .catch(error => {
        debugError('Failed to load season settings:', error);
        toast({ title: 'Error', description: 'Failed to load season settings.', variant: 'destructive' });
      })
      .finally(() => { if (!cancelled) setSeasonSettingsLoading(false); });
    return () => { cancelled = true; };
  }, [user?.is_super_admin, seasonYear, toast]);

  const handleSaveSeasonSettings = async () => {
    if (!user?.email) return;
    setSeasonSettingsSaving(true);
    try {
      const result = await updateSeasonSettings(seasonYear, {
        preseasonStartDate: preseasonStartDate || null,
        regularSeasonStartDate: regularSeasonStartDate || null,
        postseasonStartDate: postseasonStartDate || null,
        currentWeek,
        currentSeasonType,
        seasonOver,
      }, user.email);

      if (!result.success) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Saved', description: `Season ${seasonYear} settings updated.` });
    } finally {
      setSeasonSettingsSaving(false);
    }
  };

  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [googleLinked, setGoogleLinked] = useState<boolean | null>(null);
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);

  const loadAccountType = () => {
    if (!user?.id) return;
    fetch(`/api/admin/account-type?adminId=${user.id}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return;
        setIsOAuthAccount(d.isOAuth);
        setHasPassword(d.hasPassword);
        setGoogleLinked(d.googleLinked);
        setAccountCreatedAt(d.createdAt ?? null);
        if (d.notificationPreferences) setNotificationPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...d.notificationPreferences });
      })
      .catch(() => setIsOAuthAccount(false));
  };

  useEffect(loadAccountType, [user?.id]);

  // Surface the result of a "Connect Google" round trip (see
  // handleConnectGoogle below and src/app/auth/callback/route.ts's link intent).
  const searchParams = useSearchParams();
  useEffect(() => {
    const linked = searchParams.get('linked');
    const err = searchParams.get('error');
    if (!linked && !err) return;

    router.replace('/admin/account', { scroll: false });

    if (linked === 'google') {
      toast({ title: 'Google Connected', description: 'You can now sign in with either Google or your password.' });
      loadAccountType();
    } else if (err === 'google-email-mismatch') {
      toast({ title: 'Could Not Connect Google', description: "That Google account's email doesn't match your Sunday Huddle account.", variant: 'destructive' });
    } else if (err === 'google-link-failed') {
      toast({ title: 'Could Not Connect Google', description: 'Something went wrong — please try again.', variant: 'destructive' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [subscriptionSummary, setSubscriptionSummary] = useState<SubscriptionSummary | null>(null);

  useEffect(() => {
    if (!user?.id || user.is_super_admin) return;
    fetch(`/api/admin/subscription-summary?adminId=${user.id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setSubscriptionSummary(d); })
      .catch(() => {});
  }, [user?.id, user?.is_super_admin]);

  // Change password (for accounts that already have one)
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Create password (Google-only accounts, no password yet)
  const [newAccountPw, setNewAccountPw] = useState('');
  const [confirmAccountPw, setConfirmAccountPw] = useState('');
  const [createPwLoading, setCreatePwLoading] = useState(false);
  const [createPwError, setCreatePwError] = useState('');
  const [createPwSuccess, setCreatePwSuccess] = useState('');

  // Google connect/disconnect
  const [googleActionLoading, setGoogleActionLoading] = useState(false);

  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState('');
  const [emailChangeSent, setEmailChangeSent] = useState(false);

  // Notification preferences
  const [notifSaving, setNotifSaving] = useState(false);

  // Delete account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSent, setDeleteSent] = useState(false);

  const handleConnectGoogle = async () => {
    setGoogleActionLoading(true);
    try {
      const { getSupabaseBrowserClient } = await import('@/lib/supabase-browser');
      const supabase = getSupabaseBrowserClient();
      // Same cookie-based intent pattern as register/login — see
      // src/app/auth/callback/route.ts's handleLinkIntent. Requires the
      // user to already be logged in (their sh-session cookie is untouched
      // by this — see that function's comment).
      document.cookie = 'oauth_intent=link;path=/;max-age=300;samesite=lax';
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: 'select_account' },
        },
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to start Google connection. Please try again.', variant: 'destructive' });
      setGoogleActionLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!user) return;
    setGoogleActionLoading(true);
    try {
      const res = await fetch('/api/admin/unlink-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to disconnect Google');
      setGoogleLinked(false);
      toast({ title: 'Google Disconnected', description: 'You can still sign in with your password.' });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to disconnect Google', variant: 'destructive' });
    } finally {
      setGoogleActionLoading(false);
    }
  };

  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatePwError('');
    if (newAccountPw !== confirmAccountPw) { setCreatePwError("Passwords don't match"); return; }
    if (newAccountPw.length < 8) { setCreatePwError('Password must be at least 8 characters'); return; }
    if (!user) return;

    setCreatePwLoading(true);
    try {
      const res = await fetch('/api/admin/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, newPassword: newAccountPw }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatePwSuccess('Password created — you can now sign in with either Google or your password.');
        setNewAccountPw(''); setConfirmAccountPw('');
        setHasPassword(true);
        setTimeout(() => setCreatePwSuccess(''), 5000);
      } else {
        setCreatePwError(data.error || 'Failed to create password');
      }
    } catch {
      setCreatePwError('An unexpected error occurred');
    } finally {
      setCreatePwLoading(false);
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailChangeError('');
    if (!user || !newEmail) return;
    setEmailChangeLoading(true);
    try {
      const result = await requestEmailChange(user.id, newEmail);
      if (result.success) {
        setEmailChangeSent(true);
      } else {
        setEmailChangeError(result.error || 'Failed to send confirmation email');
      }
    } catch {
      setEmailChangeError('An unexpected error occurred');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleSaveNotificationPrefs = async () => {
    if (!user) return;
    setNotifSaving(true);
    try {
      const res = await fetch('/api/admin/notification-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, preferences: notificationPrefs }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save preferences');
      toast({ title: 'Saved', description: 'Notification preferences updated.' });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to save preferences', variant: 'destructive' });
    } finally {
      setNotifSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPw !== confirmPw) { setPwError("New passwords don't match"); return; }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (!user) return;

    setPwLoading(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (data.success) {
        setPwSuccess('Password updated successfully.');
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
        setTimeout(() => setPwSuccess(''), 4000);
      } else {
        setPwError(data.error || 'Failed to update password');
      }
    } catch {
      setPwError('An unexpected error occurred');
    } finally {
      setPwLoading(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!deleteConfirmed || !user) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const result = await requestDeletionConfirmation(user.id);
      if (result.success) {
        setDeleteSent(true);
      } else {
        setDeleteError(result.error || 'Failed to send confirmation email');
      }
    } catch {
      setDeleteError('An unexpected error occurred');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push(createPageUrl('login'));
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${border}`, background: surface }}>
        <div className="lp-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '3.25rem', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href={createPageUrl('admindashboard')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: textMid }}>
              <ArrowLeft style={{ width: 14, height: 14 }} />
              <BrandLogo variant="icon" size={24} />
              <span style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: text, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Sunday Huddle
              </span>
            </Link>
          </div>
          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.65rem', background: liveRed, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            <LogOut style={{ width: 12, height: 12 }} />
            Logout
          </button>
        </div>
      </nav>

      {/* Body */}
      <div className="lp-inner" style={{ flex: 1, paddingTop: '2.5rem', paddingBottom: '3rem', maxWidth: 640 }}>

        {/* Page title */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.63rem', letterSpacing: '0.28em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Commissioner
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: '2rem', color: text, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1 }}>
            Account Settings
          </h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Profile info */}
          <div style={cardSt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <User style={{ width: 15, height: 15, color: greenHi }} />
              <p style={sectionTitle}>Profile</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: emailChangeSent ? '1.25rem' : 0 }}>
              <div>
                <label style={labelSt}>Name</label>
                <p style={{ ...b, fontSize: '0.9rem', color: textMid }}>{user?.full_name || '—'}</p>
              </div>
              <div>
                <label style={labelSt}>Email</label>
                <p style={{ ...b, fontSize: '0.9rem', color: textMid }}>{user?.email}</p>
              </div>
              <div>
                <label style={labelSt}>Role</label>
                <p style={{ ...b, fontSize: '0.9rem', color: textMid }}>{user?.is_super_admin ? 'Super Admin' : 'Commissioner'}</p>
              </div>
              {accountCreatedAt && (
                <div>
                  <label style={labelSt}>Member Since</label>
                  <p style={{ ...b, fontSize: '0.9rem', color: textMid }}>
                    {new Date(accountCreatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              )}
              <div>
                <label style={{ ...labelSt, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Hash style={{ width: 10, height: 10 }} /> Account ID
                </label>
                <p style={{ ...b, fontSize: '0.76rem', color: textDim, fontFamily: 'monospace' }}>{user?.id}</p>
              </div>
            </div>

            {!user?.is_super_admin && (
              <>
                <div style={{ height: 1, background: border, margin: '1.25rem 0' }} />
                <label style={{ ...labelSt, marginBottom: '0.6rem' }}>Change Email Address</label>
                {emailChangeSent ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.9rem 1rem', background: 'oklch(46% 0.14 155 / 0.1)', border: `1px solid oklch(46% 0.14 155 / 0.35)`, borderRadius: 8 }}>
                    <Mail style={{ width: 15, height: 15, color: greenHi, flexShrink: 0, marginTop: 1 }} />
                    <p style={{ ...b, fontSize: '0.8rem', color: textMid, margin: 0 }}>
                      Check <strong style={{ color: text }}>{newEmail}</strong> and click the confirmation link to finish updating your email. The link expires in 24 hours.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleRequestEmailChange} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      placeholder="new-email@example.com"
                      style={{ ...inputSt, flex: '1 1 220px' }}
                    />
                    <button
                      type="submit"
                      disabled={emailChangeLoading || !newEmail}
                      style={{ padding: '0.5rem 1rem', background: emailChangeLoading || !newEmail ? 'oklch(35% 0.08 155)' : green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: emailChangeLoading || !newEmail ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {emailChangeLoading ? 'Sending…' : 'Send Confirmation'}
                    </button>
                  </form>
                )}
                {emailChangeError && (
                  <p style={{ ...b, fontSize: '0.78rem', color: errRed, marginTop: '0.5rem' }}>{emailChangeError}</p>
                )}
                <p style={{ ...b, fontSize: '0.76rem', color: textDim, marginTop: '0.5rem', lineHeight: 1.5 }}>
                  We&apos;ll send a confirmation link to the new address — your email won&apos;t change until you click it.
                </p>
              </>
            )}
          </div>

          {/* Season Settings (super admin only) */}
          {user?.is_super_admin && (
            <div style={cardSt}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Calendar style={{ width: 15, height: 15, color: greenHi }} />
                <p style={{ ...sectionTitle, marginBottom: 0 }}>Season Settings</p>
              </div>
              <p style={{ ...b, fontSize: '0.82rem', color: textDim, marginBottom: '1.25rem', lineHeight: 1.6 }}>
                Controls when each season phase is considered active — used to block creating a pool scoped to a phase whose last week has already started (e.g. no new preseason-only pools once preseason week 4 has begun).
              </p>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelSt}>Season Year</label>
                <input
                  type="number"
                  value={seasonYear}
                  onChange={(e) => setSeasonYear(Number(e.target.value) || getNFLSeasonYear())}
                  style={{ ...inputSt, maxWidth: 160 }}
                />
              </div>

              {seasonSettingsLoading ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: textDim, ...b, fontSize: '0.85rem' }}>Loading…</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={labelSt}>Preseason Start Date</label>
                      <input type="date" value={preseasonStartDate} onChange={(e) => setPreseasonStartDate(e.target.value)} style={inputSt} />
                    </div>
                    <div>
                      <label style={labelSt}>Regular Season Start Date</label>
                      <input type="date" value={regularSeasonStartDate} onChange={(e) => setRegularSeasonStartDate(e.target.value)} style={inputSt} />
                    </div>
                    <div>
                      <label style={labelSt}>Postseason Start Date</label>
                      <input type="date" value={postseasonStartDate} onChange={(e) => setPostseasonStartDate(e.target.value)} style={inputSt} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={labelSt}>Current Phase</label>
                      <Select value={String(currentSeasonType)} onValueChange={(v) => setCurrentSeasonType(Number(v))}>
                        <SelectTrigger style={{ background: bg, border: `1px solid ${border}`, color: text }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEASON_TYPES.map(t => (
                            <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label style={labelSt}>Current Week <span style={{ textTransform: 'none', fontWeight: 400 }}>(within that phase)</span></label>
                      <input type="number" min={1} value={currentWeek} onChange={(e) => setCurrentWeek(Number(e.target.value) || 1)} style={inputSt} />
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                    <Checkbox checked={seasonOver} onCheckedChange={(v) => setSeasonOver(v === true)} />
                    <span style={{ ...b, fontSize: '0.85rem', color: text }}>Season is over</span>
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleSaveSeasonSettings}
                      disabled={seasonSettingsSaving}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: seasonSettingsSaving ? surface : green, color: seasonSettingsSaving ? textDim : text, border: 'none', borderRadius: 6, cursor: seasonSettingsSaving ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                    >
                      <Save style={{ width: 13, height: 13 }} />
                      {seasonSettingsSaving ? 'Saving…' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subscription */}
          {!user?.is_super_admin && subscriptionSummary && (
            <div style={cardSt}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <CreditCard style={{ width: 15, height: 15, color: greenHi }} />
                <p style={sectionTitle}>Subscription</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <PlanBadge plan={subscriptionSummary.plan} isTrialActive={subscriptionSummary.isTrialActive} daysLeft={subscriptionSummary.daysLeft} />
                {subscriptionSummary.plan === 'free' && !subscriptionSummary.billingExempt && (
                  <Link href="/upgrade" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: green, color: text, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', textDecoration: 'none' }}>
                    Upgrade Plan
                  </Link>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <span style={{ ...b, fontSize: '0.82rem', color: textDim }}>Current Season</span>
                  <span style={{ ...b, fontSize: '0.82rem', color: text }}>{getNFLSeasonYear()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <span style={{ ...b, fontSize: '0.82rem', color: textDim }}>
                    {subscriptionSummary.plan === 'standard' ? 'Purchased' : 'Status'}
                  </span>
                  <span style={{ ...b, fontSize: '0.82rem', color: text }}>
                    {subscriptionSummary.billingExempt
                      ? 'Comped by site admin'
                      : subscriptionSummary.standardPurchasedAt
                      ? new Date(subscriptionSummary.standardPurchasedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : subscriptionSummary.isTrialActive
                      ? `Trial — ${subscriptionSummary.daysLeft}d left`
                      : 'Free — no purchase yet'}
                  </span>
                </div>
                {subscriptionSummary.plan === 'standard' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <span style={{ ...b, fontSize: '0.82rem', color: textDim }}>Renewal</span>
                    <span style={{ ...b, fontSize: '0.82rem', color: text }}>No auto-renewal (per-season purchase)</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <span style={{ ...b, fontSize: '0.82rem', color: textDim }}>Additional Pools Purchased</span>
                  <span style={{ ...b, fontSize: '0.82rem', color: text }}>{subscriptionSummary.addonPools}</span>
                </div>
                {subscriptionSummary.stripeCustomerId && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <span style={{ ...b, fontSize: '0.82rem', color: textDim }}>Stripe Customer ID</span>
                    <span style={{ ...b, fontSize: '0.76rem', color: textDim, fontFamily: 'monospace' }}>{subscriptionSummary.stripeCustomerId}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <Link href="/admin/account/purchases" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
                  <Receipt style={{ width: 12, height: 12 }} /> Purchases
                </Link>
                {subscriptionSummary.plan === 'standard' && !subscriptionSummary.billingExempt && (
                  <Link href="/upgrade" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: 'oklch(74% 0.16 72 / 0.12)', color: 'oklch(74% 0.16 72)', border: `1px solid oklch(74% 0.16 72 / 0.4)`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
                    <Plus style={{ width: 12, height: 12 }} /> Buy Additional Pool
                  </Link>
                )}
                {!subscriptionSummary.billingExempt && (
                  <Link href="/upgrade" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
                    Manage Subscription
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Authentication — sign-in methods */}
          {!user?.is_super_admin && (
            <div style={cardSt}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <ShieldCheck style={{ width: 15, height: 15, color: greenHi }} />
                <p style={sectionTitle}>Authentication</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0.9rem', background: bg, border: `1px solid ${border}`, borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Mail style={{ width: 15, height: 15, color: textDim }} />
                    <div>
                      <p style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', color: text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</p>
                      <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>{user?.email}</p>
                    </div>
                  </div>
                  <span style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: hasPassword ? greenHi : textDim, padding: '0.2rem 0.6rem', borderRadius: 999, background: hasPassword ? 'oklch(46% 0.14 155 / 0.12)' : 'transparent', border: hasPassword ? 'none' : `1px solid ${border}` }}>
                    {hasPassword ? 'Active' : 'No password set'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0.9rem', background: bg, border: `1px solid ${border}`, borderRadius: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <div>
                      <p style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', color: text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Google</p>
                      <p style={{ ...b, fontSize: '0.78rem', color: textDim }}>{googleLinked ? 'Connected' : 'Not connected'}</p>
                    </div>
                  </div>
                  {googleLinked ? (
                    <button
                      onClick={handleDisconnectGoogle}
                      disabled={googleActionLoading || !hasPassword}
                      title={!hasPassword ? 'Create a password below first — an account needs at least one sign-in method' : undefined}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: 'transparent', color: !hasPassword ? textDim : errRed, border: `1px solid ${!hasPassword ? border : 'oklch(62% 0.22 25 / 0.4)'}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: googleActionLoading || !hasPassword ? 'not-allowed' : 'pointer' }}
                    >
                      <Unlink style={{ width: 11, height: 11 }} />
                      {googleActionLoading ? 'Working…' : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      disabled={googleActionLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: 'transparent', color: greenHi, border: `1px solid oklch(46% 0.14 155 / 0.4)`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: googleActionLoading ? 'not-allowed' : 'pointer' }}
                    >
                      <Link2 style={{ width: 11, height: 11 }} />
                      {googleActionLoading ? 'Redirecting…' : 'Connect'}
                    </button>
                  )}
                </div>
                {googleLinked && !hasPassword && (
                  <p style={{ ...b, fontSize: '0.76rem', color: textDim, lineHeight: 1.5, margin: 0 }}>
                    Create a password below to be able to disconnect Google — an account needs at least one sign-in method.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Password */}
          <div style={cardSt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <KeyRound style={{ width: 15, height: 15, color: greenHi }} />
              <p style={sectionTitle}>{hasPassword ? 'Change Password' : 'Create a Password'}</p>
            </div>
            {hasPassword === null ? null : hasPassword ? (
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={labelSt}>Current Password</label>
                  <PasswordInput value={currentPw} onChange={setCurrentPw} placeholder="Enter current password" autoComplete="current-password" />
                </div>
                <div>
                  <label style={labelSt}>New Password</label>
                  <PasswordInput value={newPw} onChange={setNewPw} placeholder="At least 8 characters" autoComplete="new-password" />
                </div>
                <div>
                  <label style={labelSt}>Confirm New Password</label>
                  <PasswordInput value={confirmPw} onChange={setConfirmPw} placeholder="Repeat new password" autoComplete="new-password" />
                </div>

                {pwError && (
                  <div style={{ padding: '0.6rem 0.85rem', background: 'oklch(62% 0.22 25 / 0.1)', border: `1px solid oklch(62% 0.22 25 / 0.4)`, borderRadius: 6 }}>
                    <p style={{ ...b, fontSize: '0.8rem', color: errRed }}>{pwError}</p>
                  </div>
                )}
                {pwSuccess && (
                  <div style={{ padding: '0.6rem 0.85rem', background: 'oklch(46% 0.14 155 / 0.1)', border: `1px solid oklch(46% 0.14 155 / 0.4)`, borderRadius: 6 }}>
                    <p style={{ ...b, fontSize: '0.8rem', color: greenHi }}>{pwSuccess}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                  style={{ padding: '0.65rem 1.25rem', background: pwLoading || !currentPw || !newPw || !confirmPw ? 'oklch(35% 0.08 155)' : green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: pwLoading || !currentPw || !newPw || !confirmPw ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}
                >
                  {pwLoading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.9rem 1rem', background: 'oklch(26% 0.03 255)', border: `1px solid ${border}`, borderRadius: 8, marginBottom: '1rem' }}>
                  <Info style={{ width: 15, height: 15, color: textDim, flexShrink: 0, marginTop: 1 }} />
                  <p style={{ ...b, fontSize: '0.83rem', color: textMid, margin: 0, lineHeight: 1.5 }}>
                    Your account currently signs in with Google only. Create a password to be able to sign in either way.
                  </p>
                </div>
                <form onSubmit={handleCreatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={labelSt}>New Password</label>
                    <PasswordInput value={newAccountPw} onChange={setNewAccountPw} placeholder="At least 8 characters" autoComplete="new-password" />
                  </div>
                  <div>
                    <label style={labelSt}>Confirm Password</label>
                    <PasswordInput value={confirmAccountPw} onChange={setConfirmAccountPw} placeholder="Repeat password" autoComplete="new-password" />
                  </div>

                  {createPwError && (
                    <div style={{ padding: '0.6rem 0.85rem', background: 'oklch(62% 0.22 25 / 0.1)', border: `1px solid oklch(62% 0.22 25 / 0.4)`, borderRadius: 6 }}>
                      <p style={{ ...b, fontSize: '0.8rem', color: errRed }}>{createPwError}</p>
                    </div>
                  )}
                  {createPwSuccess && (
                    <div style={{ padding: '0.6rem 0.85rem', background: 'oklch(46% 0.14 155 / 0.1)', border: `1px solid oklch(46% 0.14 155 / 0.4)`, borderRadius: 6 }}>
                      <p style={{ ...b, fontSize: '0.8rem', color: greenHi }}>{createPwSuccess}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={createPwLoading || !newAccountPw || !confirmAccountPw}
                    style={{ padding: '0.65rem 1.25rem', background: createPwLoading || !newAccountPw || !confirmAccountPw ? 'oklch(35% 0.08 155)' : green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: createPwLoading || !newAccountPw || !confirmAccountPw ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}
                  >
                    {createPwLoading ? 'Creating…' : 'Create Password'}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Notifications */}
          {!user?.is_super_admin && (
            <div style={cardSt}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Bell style={{ width: 15, height: 15, color: greenHi }} />
                <p style={sectionTitle}>Notifications</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
                {([
                  { key: 'pick_reminders', label: 'Pick Reminders', desc: 'Get notified when your participants are close to a picks deadline.' },
                  { key: 'weekly_summaries', label: 'Weekly Summaries', desc: 'A recap of your pools after each week wraps up.' },
                  { key: 'season_announcements', label: 'Season Announcements', desc: 'Season kickoff, playoff, and end-of-season updates.' },
                  { key: 'product_updates', label: 'Product Updates', desc: 'New features and changes to Sunday Huddle.' },
                ] as const).map(({ key, label, desc }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer' }}>
                    <Checkbox
                      checked={notificationPrefs[key]}
                      onCheckedChange={(v) => setNotificationPrefs(prev => ({ ...prev, [key]: v === true }))}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <p style={{ ...bc, fontWeight: 700, fontSize: '0.8rem', color: text, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.15rem' }}>{label}</p>
                      <p style={{ ...b, fontSize: '0.78rem', color: textDim, lineHeight: 1.4 }}>{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={handleSaveNotificationPrefs}
                disabled={notifSaving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: notifSaving ? surface : green, color: notifSaving ? textDim : text, border: 'none', borderRadius: 6, cursor: notifSaving ? 'not-allowed' : 'pointer', ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
              >
                <Save style={{ width: 13, height: 13 }} />
                {notifSaving ? 'Saving…' : 'Save Preferences'}
              </button>
            </div>
          )}

          {/* Danger zone */}
          {!user?.is_super_admin && (
            <div style={{ ...cardSt, borderColor: 'oklch(62% 0.22 25 / 0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Trash2 style={{ width: 15, height: 15, color: errRed }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: errRed, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Danger Zone</p>
              </div>
              <p style={{ ...b, fontSize: '0.82rem', color: textDim, marginBottom: '1rem' }}>
                Permanently delete your commissioner account. This cannot be undone — your profile, sign-in access, and account settings are removed. Pools you created are archived (not deleted): the historical picks, scores, and standings your participants earned are preserved, just no longer active or visible from your account.
              </p>
              {deleteSent ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.9rem 1rem', background: 'oklch(46% 0.14 155 / 0.1)', border: `1px solid oklch(46% 0.14 155 / 0.35)`, borderRadius: 8 }}>
                  <Mail style={{ width: 15, height: 15, color: greenHi, flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', color: greenHi, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>Confirmation Email Sent</p>
                    <p style={{ ...b, fontSize: '0.8rem', color: textMid, margin: 0 }}>
                      Check your inbox and click the link to confirm deletion. The link expires in 24 hours.
                    </p>
                  </div>
                </div>
              ) : !showDeleteDialog ? (
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'transparent', color: errRed, border: `1px solid oklch(62% 0.22 25 / 0.5)`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  <Trash2 style={{ width: 13, height: 13 }} />
                  Delete Account
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', background: 'oklch(62% 0.22 25 / 0.07)', border: `1px solid oklch(62% 0.22 25 / 0.3)`, borderRadius: 8 }}>
                  <p style={{ ...bc, fontWeight: 700, fontSize: '0.82rem', color: errRed, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Confirm Account Deletion
                  </p>
                  <p style={{ ...b, fontSize: '0.8rem', color: textDim, margin: 0 }}>
                    We&apos;ll send a confirmation link to <strong style={{ color: textMid }}>{user?.email}</strong>. Click it to permanently delete your account.
                  </p>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={deleteConfirmed}
                      onChange={e => setDeleteConfirmed(e.target.checked)}
                      style={{ marginTop: 2, flexShrink: 0, accentColor: errRed }}
                    />
                    <span style={{ ...b, fontSize: '0.8rem', color: textMid }}>
                      I understand this is permanent, cannot be undone, and will archive any pools I created
                    </span>
                  </label>

                  {deleteError && (
                    <p style={{ ...b, fontSize: '0.8rem', color: errRed }}>{deleteError}</p>
                  )}

                  <div style={{ display: 'flex', gap: '0.65rem' }}>
                    <button
                      onClick={handleRequestDeletion}
                      disabled={deleteLoading || !deleteConfirmed}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', background: deleteLoading || !deleteConfirmed ? 'oklch(40% 0.1 25)' : liveRed, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: deleteLoading || !deleteConfirmed ? 'not-allowed' : 'pointer' }}
                    >
                      <Mail style={{ width: 12, height: 12 }} />
                      {deleteLoading ? 'Sending…' : 'Send Confirmation Email'}
                    </button>
                    <button
                      onClick={() => { setShowDeleteDialog(false); setDeleteConfirmed(false); setDeleteError(''); }}
                      style={{ padding: '0.55rem 1rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <Footer pageName="Account Settings" />
    </div>
  );
}

export default function AccountSettingsPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <Suspense fallback={null}>
          <AccountSettingsContent />
        </Suspense>
      </AdminGuard>
    </AuthProvider>
  );
}
