'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { requestDeletionConfirmation } from '@/actions/accountDeletion';
import { Footer } from '@/components/layout/Footer';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Eye, EyeOff, LogOut, Trash2, KeyRound, User, ArrowLeft, Mail, Info, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { createPageUrl } from '@/lib/utils';

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

  const [isOAuthAccount, setIsOAuthAccount] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/admin/account-type?adminId=${user.id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setIsOAuthAccount(d.isOAuth); })
      .catch(() => setIsOAuthAccount(false));
  }, [user?.id]);

  const [planStatus, setPlanStatus] = useState<{ plan: string; isTrialActive: boolean; daysLeft: number } | null>(null);

  useEffect(() => {
    if (!user?.id || user.is_super_admin) return;
    fetch(`/api/admin/plan-status?adminId=${user.id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setPlanStatus(d); })
      .catch(() => {});
  }, [user?.id, user?.is_super_admin]);

  // Change password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Delete account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSent, setDeleteSent] = useState(false);

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
            </div>
          </div>

          {/* Plan & billing */}
          {!user?.is_super_admin && planStatus && (
            <div style={cardSt}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <CreditCard style={{ width: 15, height: 15, color: greenHi }} />
                <p style={sectionTitle}>Plan &amp; Billing</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {planStatus.plan.charAt(0).toUpperCase() + planStatus.plan.slice(1)}
                    {planStatus.isTrialActive && <span style={{ color: textDim, fontWeight: 700, fontSize: '0.7rem', marginLeft: '0.5rem' }}>TRIAL · {planStatus.daysLeft}d left</span>}
                  </p>
                  <p style={{ ...b, fontSize: '0.82rem', color: textMid, marginTop: '0.2rem' }}>
                    {planStatus.plan === 'free' ? 'One pool, up to 15 participants.' : 'Manage your plan, or switch back to Free.'}
                  </p>
                </div>
                <Link
                  href="/upgrade"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.5rem 1rem', background: green, color: text,
                    borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.75rem',
                    letterSpacing: '0.07em', textTransform: 'uppercase', textDecoration: 'none',
                  }}
                >
                  Manage Plan
                </Link>
              </div>
            </div>
          )}

          {/* Change password */}
          <div style={cardSt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <KeyRound style={{ width: 15, height: 15, color: greenHi }} />
              <p style={sectionTitle}>Change Password</p>
            </div>
            {isOAuthAccount ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.9rem 1rem', background: 'oklch(26% 0.03 255)', border: `1px solid ${border}`, borderRadius: 8 }}>
                <Info style={{ width: 15, height: 15, color: textDim, flexShrink: 0, marginTop: 1 }} />
                <p style={{ ...b, fontSize: '0.83rem', color: textMid, margin: 0, lineHeight: 1.5 }}>
                  Password changes are not available for Google sign-in accounts. Your account is managed through Google.
                </p>
              </div>
            ) : (
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
            )}
          </div>

          {/* Danger zone */}
          {!user?.is_super_admin && (
            <div style={{ ...cardSt, borderColor: 'oklch(62% 0.22 25 / 0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Trash2 style={{ width: 15, height: 15, color: errRed }} />
                <p style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: errRed, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Danger Zone</p>
              </div>
              <p style={{ ...b, fontSize: '0.82rem', color: textDim, marginBottom: '1rem' }}>
                Permanently delete your commissioner account. This cannot be undone. Any pools you created will be deleted along with all their picks, scores, and participants. Pools created by other commissioners that you participate in are not affected.
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
                      I understand this is permanent, cannot be undone, and will delete any pools I created
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
        <AccountSettingsContent />
      </AdminGuard>
    </AuthProvider>
  );
}
