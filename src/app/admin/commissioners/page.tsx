'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Search, Users, Shield, Eye, EyeOff, Trash2,
  RefreshCw, Key, UserX, UserCheck, AlertTriangle, LogOut,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminService, Admin } from '@/lib/admin-service';
import { debugLog } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
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

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

function CommissionersManagementContent() {
  const { user, signOut, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [commissioners, setCommissioners] = useState<Admin[]>([]);
  const [filteredCommissioners, setFilteredCommissioners] = useState<Admin[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [stats, setStats] = useState({ totalCommissioners: 0, activeCommissioners: 0, inactiveCommissioners: 0 });
  const [selectedCommissioner, setSelectedCommissioner] = useState<Admin | null>(null);
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
          if (!superAdminStatus) { router.push('/dashboard'); return; }
          await loadCommissioners();
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

  const loadCommissioners = async () => {
    try {
      if (!user?.email) return;
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      const { data: adminsData, error: adminsError } = await supabase.from('admins').select('*').order('created_at', { ascending: false });
      if (adminsError) throw adminsError;
      const commissionersData = adminsData?.filter(admin => !admin.is_super_admin) || [];
      setCommissioners(commissionersData);
      setFilteredCommissioners(commissionersData);
    } catch (error) {
      console.error('Error loading commissioners:', error);
      toast({ title: 'Error', description: 'Failed to load commissioners data', variant: 'destructive' });
    }
  };

  const loadStats = async () => {
    try {
      if (!user?.email) return;
      const { getSupabaseServiceClient } = await import('@/lib/supabase');
      const supabase = getSupabaseServiceClient();
      const { data: commissionersData } = await supabase.from('admins').select('is_active').eq('is_super_admin', false);
      const totalCommissioners = commissionersData?.length || 0;
      const activeCommissioners = commissionersData?.filter(c => c.is_active).length || 0;
      setStats({ totalCommissioners, activeCommissioners, inactiveCommissioners: totalCommissioners - activeCommissioners });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredCommissioners(commissioners);
    } else {
      setFilteredCommissioners(commissioners.filter(c =>
        c.full_name?.toLowerCase().includes(term.toLowerCase()) ||
        c.email.toLowerCase().includes(term.toLowerCase())
      ));
    }
  };

  const handleResetPassword = async () => {
    if (!selectedCommissioner || !newPassword.trim()) {
      toast({ title: 'Error', description: 'Please enter a new password', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error('No active session');
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ adminId: selectedCommissioner.id, newPassword: newPassword.trim() }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Password Reset', description: `Password reset for ${selectedCommissioner.email}` });
        setResetPasswordModalOpen(false);
        setNewPassword('');
        setSelectedCommissioner(null);
      } else throw new Error(result.error || 'Failed');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to reset password.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleStatus = async (commissioner: Admin) => {
    setIsProcessing(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error('No active session');
      const response = await fetch('/api/admin/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ adminId: commissioner.id, isActive: !commissioner.is_active }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Status Updated', description: `${commissioner.email} ${commissioner.is_active ? 'deactivated' : 'activated'}` });
        await loadCommissioners();
        await loadStats();
      } else throw new Error(result.error || 'Failed');
    } catch {
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCommissioner = async () => {
    if (!selectedCommissioner) return;
    setIsProcessing(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error('No active session');
      const response = await fetch('/api/admin/delete-commissioner', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ adminId: selectedCommissioner.id }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Commissioner Deleted', description: `${selectedCommissioner.email} permanently deleted` });
        setDeleteModalOpen(false);
        setSelectedCommissioner(null);
        await loadCommissioners();
        await loadStats();
      } else throw new Error(result.error || 'Failed');
    } catch {
      toast({ title: 'Error', description: 'Failed to delete commissioner.', variant: 'destructive' });
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
    { label: 'Total', value: stats.totalCommissioners, color: gold, sub: 'All time' },
    { label: 'Active', value: stats.activeCommissioners, color: greenHi, sub: 'Currently active' },
    { label: 'Inactive', value: stats.inactiveCommissioners, color: liveRed, sub: 'Deactivated' },
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
                  <Users style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Commissioners</span>
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
          <div className="admin-3col-grid" style={{ marginBottom: 0 }}>
            {statItems.map(({ label, value, color, sub }) => (
              <div key={label} style={{ background: card, border: `1px solid ${border}`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '1.25rem' }}>
                <div style={{ ...bc, fontWeight: 900, fontSize: '2.25rem', color, lineHeight: 1, letterSpacing: '0.02em' }}>{value}</div>
                <div style={{ ...bc, fontWeight: 700, fontSize: '0.72rem', color: text, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: '0.3rem' }}>{label}</div>
                <div style={{ ...b, fontSize: '0.7rem', color: textDim, marginTop: '0.15rem' }}>{sub}</div>
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
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ display: 'block', width: 3, height: 22, background: green, borderRadius: 2 }} />
            <h3 style={{ ...bc, fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
              All Commissioners ({filteredCommissioners.length})
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

          {/* Commissioner list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredCommissioners.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: surface, border: `1px solid ${border}`, borderRadius: 8 }}>
                <Users style={{ width: 40, height: 40, color: textDim, margin: '0 auto 1rem' }} />
                <p style={{ ...b, color: textDim, fontSize: '0.9rem' }}>
                  {searchTerm ? 'No commissioners found matching your search.' : 'No commissioners created yet.'}
                </p>
              </div>
            ) : (
              filteredCommissioners.map((commissioner) => (
                <div key={commissioner.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, padding: '1.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', flex: 1, minWidth: 0 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg, oklch(46% 0.14 155), oklch(62% 0.12 270))`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ ...bc, fontWeight: 900, fontSize: '1rem', color: text }}>
                          {(commissioner.full_name?.charAt(0) || commissioner.email.charAt(0)).toUpperCase()}
                        </span>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                          <span style={{ ...bc, fontWeight: 700, fontSize: '1rem', color: text, letterSpacing: '0.02em' }}>
                            {commissioner.full_name || 'Unnamed Commissioner'}
                          </span>
                          <span style={{ ...bc, fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.1em', color: commissioner.is_active ? greenHi : liveRed, textTransform: 'uppercase', background: commissioner.is_active ? 'oklch(46% 0.14 155 / 0.15)' : 'oklch(50% 0.22 25 / 0.15)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>
                            {commissioner.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>{commissioner.email}</p>
                        <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.2rem' }}>
                          Created {new Date(commissioner.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <button
                        onClick={() => { setSelectedCommissioner(commissioner); setResetPasswordModalOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'transparent', color: textMid, border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
                      >
                        <Key style={{ width: 11, height: 11 }} /> Reset Password
                      </button>

                      <button
                        onClick={() => handleToggleStatus(commissioner)}
                        disabled={isProcessing}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: commissioner.is_active ? 'oklch(50% 0.22 25 / 0.15)' : 'oklch(46% 0.14 155 / 0.15)', color: commissioner.is_active ? liveRed : greenHi, border: `1px solid ${commissioner.is_active ? liveRed : greenHi}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}
                      >
                        {commissioner.is_active
                          ? <><UserX style={{ width: 11, height: 11 }} /> Deactivate</>
                          : <><UserCheck style={{ width: 11, height: 11 }} /> Activate</>
                        }
                      </button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            onClick={() => setSelectedCommissioner(commissioner)}
                            disabled={isProcessing}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'oklch(50% 0.22 25 / 0.15)', color: liveRed, border: `1px solid ${liveRed}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}
                          >
                            <Trash2 style={{ width: 11, height: 11 }} /> Delete
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <AlertTriangle style={{ width: 18, height: 18 }} /> Delete Commissioner
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to permanently delete {commissioner.full_name || commissioner.email}? This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteCommissioner} className="bg-red-600 hover:bg-red-700" disabled={isProcessing}>
                              {isProcessing ? 'Deleting…' : 'Delete Permanently'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key style={{ width: 18, height: 18 }} /> Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for {selectedCommissioner?.full_name || selectedCommissioner?.email}
            </DialogDescription>
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
                  placeholder="Enter new password"
                  className="pr-12"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => { setResetPasswordModalOpen(false); setNewPassword(''); setSelectedCommissioner(null); }} style={{ padding: '0.45rem 0.875rem', background: 'transparent', border: `1px solid ${border}`, borderRadius: 5, ...bc, fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: textMid, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleResetPassword} disabled={!newPassword.trim() || isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.875rem', background: green, color: text, border: 'none', borderRadius: 5, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: (!newPassword.trim() || isProcessing) ? 'not-allowed' : 'pointer', opacity: (!newPassword.trim() || isProcessing) ? 0.6 : 1 }}>
                {isProcessing ? <><RefreshCw style={{ width: 12, height: 12 }} className="animate-spin" /> Resetting…</> : <><Key style={{ width: 12, height: 12 }} /> Reset Password</>}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CommissionersManagementPage() {
  return (
    <AuthProvider>
      <AdminGuard>
        <CommissionersManagementContent />
      </AdminGuard>
    </AuthProvider>
  );
}
