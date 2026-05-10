'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Search, Users, Shield, Eye, EyeOff, Trash2, LogOut,
  RefreshCw, Key, UserX, UserCheck, AlertTriangle, Crown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Admin } from '@/lib/admin-service';
import { debugLog } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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

function ManageAdminsContent() {
  const { user, signOut, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [filteredAdmins, setFilteredAdmins] = useState<Admin[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [stats, setStats] = useState({ totalAdmins: 0, superAdmins: 0, commissioners: 0, activeAdmins: 0, inactiveAdmins: 0 });
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (user) {
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);
          if (!superAdminStatus) { router.push('/admin/dashboard'); return; }
          await loadAdmins();
          await loadStats();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user, verifyAdminStatus, router]);

  const loadAdmins = async () => {
    try {
      if (!user?.email) return;
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      const { data: adminsData, error } = await supabase.from('admins').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setAdmins(adminsData || []);
      setFilteredAdmins(adminsData || []);
    } catch (error) {
      console.error('Error loading admins:', error);
      toast({ title: 'Error', description: 'Failed to load admins data', variant: 'destructive' });
    }
  };

  const loadStats = async () => {
    try {
      if (!user?.email) return;
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      const { data } = await supabase.from('admins').select('is_super_admin, is_active');
      const totalAdmins = data?.length || 0;
      const superAdmins = data?.filter(a => a.is_super_admin).length || 0;
      const activeAdmins = data?.filter(a => a.is_active).length || 0;
      setStats({ totalAdmins, superAdmins, commissioners: totalAdmins - superAdmins, activeAdmins, inactiveAdmins: totalAdmins - activeAdmins });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredAdmins(admins);
    } else {
      setFilteredAdmins(admins.filter(a =>
        a.full_name?.toLowerCase().includes(term.toLowerCase()) ||
        a.email.toLowerCase().includes(term.toLowerCase())
      ));
    }
  };

  const handleResetPassword = async () => {
    if (!selectedAdmin || !newPassword.trim()) {
      toast({ title: 'Error', description: 'Please enter a new password', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error('No active session');
      const response = await fetch('/api/admin/reset-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ adminId: selectedAdmin.id, newPassword }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Password Reset', description: `Password reset for ${selectedAdmin.email}` });
        setResetPasswordModalOpen(false);
        setSelectedAdmin(null);
        setNewPassword('');
      } else throw new Error(result.error || 'Failed');
    } catch {
      toast({ title: 'Error', description: 'Failed to reset password.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleStatus = async (admin: Admin) => {
    setIsProcessing(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error('No active session');
      const response = await fetch('/api/admin/toggle-admin-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ adminId: admin.id }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Status Updated', description: `${admin.email} ${admin.is_active ? 'deactivated' : 'activated'}` });
        await loadAdmins();
        await loadStats();
      } else throw new Error(result.error || 'Failed');
    } catch {
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;
    setIsProcessing(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error('No active session');
      const response = await fetch('/api/admin/delete-admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ adminId: selectedAdmin.id }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Admin Deleted', description: `${selectedAdmin.email} permanently deleted` });
        setDeleteModalOpen(false);
        setSelectedAdmin(null);
        await loadAdmins();
        await loadStats();
      } else throw new Error(result.error || 'Failed');
    } catch {
      toast({ title: 'Error', description: 'Failed to delete admin.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      await getSupabaseClient().auth.signOut();
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
    { label: 'Total Admins',   value: stats.totalAdmins,   color: gold },
    { label: 'Super Admins',   value: stats.superAdmins,   color: purple },
    { label: 'Commissioners',  value: stats.commissioners,  color: greenHi },
    { label: 'Active',         value: stats.activeAdmins,  color: greenHi },
    { label: 'Inactive',       value: stats.inactiveAdmins, color: liveRed },
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
              All Admins ({filteredAdmins.length})
            </h3>
          </div>

          <div style={{ marginBottom: '1.25rem', maxWidth: 400 }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: textDim }} />
              <Input
                placeholder="Search by name or email…"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                style={{ background: card, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.85rem', paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredAdmins.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                <p style={{ ...b, color: textDim, fontSize: '0.9rem' }}>
                  {searchTerm ? 'No admins found matching your search.' : 'No admins created yet.'}
                </p>
              </div>
            ) : (
              filteredAdmins.map((admin) => (
                <div key={admin.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, oklch(46% 0.14 155), oklch(65% 0.12 290))`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ ...bc, fontWeight: 900, fontSize: '1rem', color: text }}>
                          {(admin.full_name?.charAt(0) || admin.email.charAt(0)).toUpperCase()}
                        </span>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                          <span style={{ ...bc, fontWeight: 700, fontSize: '1rem', color: text }}>{admin.full_name || 'No Name'}</span>
                          <span style={{ ...bc, fontWeight: 600, fontSize: '0.62rem', letterSpacing: '0.1em', color: admin.is_super_admin ? purple : greenHi, background: admin.is_super_admin ? 'oklch(65% 0.12 290 / 0.15)' : 'oklch(46% 0.14 155 / 0.15)', padding: '0.15rem 0.4rem', borderRadius: 4, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            {admin.is_super_admin ? <><Crown style={{ width: 9, height: 9 }} /> Admin</> : <><Shield style={{ width: 9, height: 9 }} /> Commissioner</>}
                          </span>
                          <span style={{ ...bc, fontWeight: 600, fontSize: '0.62rem', letterSpacing: '0.1em', color: admin.is_active ? greenHi : liveRed, background: admin.is_active ? 'oklch(46% 0.14 155 / 0.15)' : 'oklch(50% 0.22 25 / 0.15)', padding: '0.15rem 0.4rem', borderRadius: 4, textTransform: 'uppercase' }}>
                            {admin.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>{admin.email}</p>
                        <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.15rem' }}>Created {new Date(admin.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <button
                        onClick={() => { setSelectedAdmin(admin); setResetPasswordModalOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                      >
                        <Key style={{ width: 11, height: 11 }} /> Reset Password
                      </button>

                      <button
                        onClick={() => handleToggleStatus(admin)}
                        disabled={isProcessing}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: admin.is_active ? 'oklch(50% 0.22 25 / 0.15)' : 'oklch(46% 0.14 155 / 0.15)', color: admin.is_active ? liveRed : greenHi, border: `1px solid ${admin.is_active ? liveRed : greenHi}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}
                      >
                        {admin.is_active ? <><UserX style={{ width: 11, height: 11 }} /> Deactivate</> : <><UserCheck style={{ width: 11, height: 11 }} /> Activate</>}
                      </button>

                      {!admin.is_super_admin && (
                        <AlertDialog open={deleteModalOpen && selectedAdmin?.id === admin.id} onOpenChange={(open) => {
                          if (open) { setSelectedAdmin(admin); setDeleteModalOpen(true); }
                          else { setDeleteModalOpen(false); setSelectedAdmin(null); }
                        }}>
                          <button
                            onClick={() => { setSelectedAdmin(admin); setDeleteModalOpen(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'oklch(50% 0.22 25 / 0.15)', color: liveRed, border: `1px solid ${liveRed}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                          >
                            <Trash2 style={{ width: 11, height: 11 }} /> Delete
                          </button>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Admin</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to permanently delete {admin.email}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteAdmin} className="bg-red-600 hover:bg-red-700" disabled={isProcessing}>
                                {isProcessing ? 'Deleting…' : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer pageName="Commissioner HQ" />

      {/* Reset Password Modal */}
      <Dialog open={resetPasswordModalOpen} onOpenChange={setResetPasswordModalOpen}>
        <DialogContent style={{ maxWidth: '28rem' }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key style={{ width: 18, height: 18 }} /> Reset Password
            </DialogTitle>
            <DialogDescription>Set a new password for {selectedAdmin?.email}</DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.25rem' }}>
              <button onClick={handleResetPassword} disabled={isProcessing || newPassword.length < 6} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.875rem', background: green, color: text, border: 'none', borderRadius: 5, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: (isProcessing || newPassword.length < 6) ? 'not-allowed' : 'pointer', opacity: (isProcessing || newPassword.length < 6) ? 0.6 : 1 }}>
                {isProcessing ? <><RefreshCw style={{ width: 12, height: 12 }} className="animate-spin" /> Resetting…</> : <><Key style={{ width: 12, height: 12 }} /> Reset Password</>}
              </button>
              <button onClick={() => { setResetPasswordModalOpen(false); setSelectedAdmin(null); setNewPassword(''); }} disabled={isProcessing} style={{ padding: '0.45rem 0.875rem', background: 'transparent', border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: textMid, cursor: 'pointer' }}>
                Cancel
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
