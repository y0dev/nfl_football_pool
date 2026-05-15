'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Search, Users, Shield, Eye, EyeOff, Trash2, LogOut,
  RefreshCw, Key, UserX, UserCheck, Crown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AdminUser } from '@/lib/admin-domain.types';
import { useAdminDomain } from '@/lib/admin-domain.client';
import { AdminDomainRules } from '@/lib/admin-domain.rules';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
const liveRed = 'oklch(62% 0.22 25)';
const purple  = 'oklch(65% 0.12 290)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

const inputStyle = {
  ...b, background: surface, border: `1px solid ${border}`, color: text,
  padding: '0.5rem 0.75rem', width: '100%', borderRadius: 6,
  boxSizing: 'border-box' as const, fontSize: '0.875rem',
};

function ManageAdminsContent() {
  const { signOut } = useAuth();
  const router = useRouter();
  const { users, stats, isLoading, actions } = useAdminDomain();

  const [searchTerm, setSearchTerm]   = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selected, setSelected]       = useState<AdminUser | null>(null);
  const [resetOpen, setResetOpen]     = useState(false);
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  const handleToggle = async (u: AdminUser) => {
    setIsProcessing(true);
    try { await actions.toggle(u); }
    finally { setIsProcessing(false); }
  };

  const handleResetPassword = async () => {
    if (!selected) return;
    const err = AdminDomainRules.validatePassword(newPassword);
    if (err) { setPasswordError(err); return; }
    setPasswordError('');
    setIsProcessing(true);
    try {
      await actions.resetPassword(selected, newPassword);
      setResetOpen(false);
      setSelected(null);
      setNewPassword('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsProcessing(true);
    try {
      await actions.remove(selected);
      setDeleteOpen(false);
      setSelected(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push('/admin/login');
    } catch {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div className="animate-spin rounded-full h-16 w-16" style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: border, borderTopColor: green }} />
      </div>
    );
  }

  const statItems = [
    { label: 'Total Admins',    value: stats.total,         color: gold },
    { label: 'Administrators',  value: stats.superAdmins,   color: purple },
    { label: 'Commissioners',   value: stats.commissioners, color: greenHi },
    { label: 'Active',          value: stats.active,        color: greenHi },
    { label: 'Inactive',        value: stats.inactive,      color: liveRed },
  ];

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(13% 0.025 255 / 0.95)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <button onClick={() => router.push('/admin/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <ArrowLeft style={{ width: 12, height: 12 }} /> Back
              </button>
              <div style={{ width: 1, height: 20, background: border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Shield style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Admin Management</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button onClick={() => router.push('/admin/create-commissioner')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Users style={{ width: 12, height: 12 }} /> Add Commissioner
              </button>
              <button onClick={handleLogout} disabled={isLoggingOut} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', background: liveRed, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isLoggingOut ? 'not-allowed' : 'pointer', opacity: isLoggingOut ? 0.6 : 1 }}>
                <LogOut style={{ width: 12, height: 12 }} /> Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── STATS ── */}
      <section style={{ background: surface, padding: '2.5rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
            <h2 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>Overview</h2>
          </div>
          <div className="admin-5col-grid" style={{ marginBottom: 0 }}>
            {statItems.map(({ label, value, color }) => (
              <div key={label} style={{ background: card, border: `1px solid ${border}`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '1rem' }}>
                <div style={{ ...bc, fontWeight: 900, fontSize: '2rem', color, lineHeight: 1, letterSpacing: '0.02em' }}>{value}</div>
                <div style={{ ...bc, fontWeight: 700, fontSize: '0.68rem', color: text, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: '0.3rem' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── LIST ── */}
      <section style={{ background: bg, padding: '3rem 0' }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
            <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
              All Admins ({filtered.length})
            </h3>
          </div>

          <div style={{ marginBottom: '1.25rem', maxWidth: 400 }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: textDim }} />
              <Input
                placeholder="Search by name or email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: card, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.85rem', paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                <p style={{ ...b, color: textDim, fontSize: '0.9rem' }}>
                  {searchTerm ? 'No admins found matching your search.' : 'No admins created yet.'}
                </p>
              </div>
            ) : (
              filtered.map((u) => {
                const isSuperAdmin = u.role === 'SUPER_ADMIN';
                return (
                  <div key={u.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, oklch(46% 0.14 155), oklch(65% 0.12 290))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ ...bc, fontWeight: 900, fontSize: '1rem', color: text }}>
                            {(u.name?.charAt(0) || u.email.charAt(0)).toUpperCase()}
                          </span>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                            <span style={{ ...bc, fontWeight: 700, fontSize: '1rem', color: text }}>{u.name || 'No Name'}</span>
                            <span style={{ ...bc, fontWeight: 600, fontSize: '0.62rem', letterSpacing: '0.1em', color: isSuperAdmin ? purple : greenHi, background: isSuperAdmin ? 'oklch(65% 0.12 290 / 0.15)' : 'oklch(46% 0.14 155 / 0.15)', padding: '0.15rem 0.4rem', borderRadius: 4, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              {isSuperAdmin ? <><Crown style={{ width: 9, height: 9 }} /> Admin</> : <><Shield style={{ width: 9, height: 9 }} /> Commissioner</>}
                            </span>
                            <span style={{ ...bc, fontWeight: 600, fontSize: '0.62rem', letterSpacing: '0.1em', color: u.isActive ? greenHi : liveRed, background: u.isActive ? 'oklch(46% 0.14 155 / 0.15)' : 'oklch(50% 0.22 25 / 0.15)', padding: '0.15rem 0.4rem', borderRadius: 4, textTransform: 'uppercase' }}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>{u.email}</p>
                          <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.15rem' }}>Created {new Date(u.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <button
                          onClick={() => { setSelected(u); setResetOpen(true); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                        >
                          <Key style={{ width: 11, height: 11 }} /> Reset Password
                        </button>

                        {AdminDomainRules.canToggle(u) && (
                          <button
                            onClick={() => handleToggle(u)}
                            disabled={isProcessing}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: u.isActive ? 'oklch(50% 0.22 25 / 0.15)' : 'oklch(46% 0.14 155 / 0.15)', color: u.isActive ? liveRed : greenHi, border: `1px solid ${u.isActive ? liveRed : greenHi}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}
                          >
                            {u.isActive ? <><UserX style={{ width: 11, height: 11 }} /> Deactivate</> : <><UserCheck style={{ width: 11, height: 11 }} /> Activate</>}
                          </button>
                        )}

                        {AdminDomainRules.canDelete(u) && (
                          <button
                            onClick={() => { setSelected(u); setDeleteOpen(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'oklch(50% 0.22 25 / 0.15)', color: liveRed, border: `1px solid ${liveRed}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                          >
                            <Trash2 style={{ width: 11, height: 11 }} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer pageName="Admin Management" />

      {/* ── Delete Confirm Dialog ── */}
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setSelected(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selected?.email}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isProcessing}
              style={{ background: 'oklch(50% 0.22 25 / 0.2)', color: liveRed, border: `1px solid oklch(62% 0.22 25 / 0.5)` }}
            >
              {isProcessing ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reset Password Dialog ── */}
      <Dialog open={resetOpen} onOpenChange={(open) => { setResetOpen(open); if (!open) { setSelected(null); setNewPassword(''); setPasswordError(''); } }}>
        <DialogContent style={{ maxWidth: '26rem' }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <Key style={{ width: 16, height: 16, color: greenHi }} /> Reset Password
            </DialogTitle>
            <DialogDescription style={{ ...b, fontSize: '0.8rem', color: textDim }}>
              Set a new password for <strong style={{ color: text }}>{selected?.name || selected?.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.25rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="e.g. MyPass1!"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                style={{ ...inputStyle, paddingRight: '2.5rem', border: `1px solid ${passwordError ? liveRed : border}` }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 0.75rem', background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {showPassword ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
              </button>
            </div>
            <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '-0.5rem' }}>
              Min {AdminDomainRules.passwordMinLength()} chars · uppercase · lowercase · number · special character
            </p>
            {passwordError && (
              <p style={{ ...b, fontSize: '0.78rem', color: liveRed, background: `oklch(62% 0.22 25 / 0.08)`, border: `1px solid oklch(62% 0.22 25 / 0.3)`, borderRadius: 5, padding: '0.4rem 0.65rem', marginTop: '-0.25rem' }}>
                {passwordError}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => { setResetOpen(false); setSelected(null); setNewPassword(''); setPasswordError(''); }}
                style={{ padding: '0.45rem 0.875rem', background: 'transparent', border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: textMid, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={isProcessing || !newPassword}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.875rem', background: green, color: text, border: 'none', borderRadius: 5, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: (isProcessing || !newPassword) ? 'not-allowed' : 'pointer', opacity: (isProcessing || !newPassword) ? 0.6 : 1 }}
              >
                {isProcessing
                  ? <><RefreshCw style={{ width: 12, height: 12, animation: 'spin 0.8s linear infinite' }} /> Resetting…</>
                  : <><Key style={{ width: 12, height: 12 }} /> Reset Password</>}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ManageAdminsPage() {
  return (
    <AuthProvider>
      <AdminGuard requireSuperAdmin={true}>
        <ManageAdminsContent />
      </AdminGuard>
    </AuthProvider>
  );
}
