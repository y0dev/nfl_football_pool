'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { AdminUser, AdminDomainStats } from './admin-domain.types';
import { AdminDomainService } from './admin-domain.service';

export interface AdminDomainActions {
  toggle: (user: AdminUser) => Promise<void>;
  resetPassword: (user: AdminUser, password: string) => Promise<void>;
  remove: (user: AdminUser) => Promise<void>;
}

export interface AdminDomainResult {
  users: AdminUser[];
  commissioners: AdminUser[];
  superAdmins: AdminUser[];
  stats: AdminDomainStats;
  isLoading: boolean;
  refresh: () => Promise<void>;
  actions: AdminDomainActions;
}

export function useAdminDomain(): AdminDomainResult {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const callerEmail = user?.email ?? '';

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await AdminDomainService.fetchAll();
      setUsers(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const commissioners = useMemo(
    () => users.filter(u => u.role === 'COMMISSIONER'),
    [users],
  );

  const superAdmins = useMemo(
    () => users.filter(u => u.role === 'SUPER_ADMIN'),
    [users],
  );

  const stats = useMemo<AdminDomainStats>(() => ({
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    superAdmins: superAdmins.length,
    commissioners: commissioners.length,
    byPlan: {
      free: commissioners.filter(u => u.plan === 'free').length,
      standard: commissioners.filter(u => u.plan === 'standard').length,
      pro: commissioners.filter(u => u.plan === 'pro').length,
    },
  }), [users, commissioners, superAdmins]);

  const actions: AdminDomainActions = {
    async toggle(target) {
      try {
        await AdminDomainService.toggle(target, callerEmail);
        await load();
        toast({
          title: 'Status Updated',
          description: `${target.name || target.email} ${target.isActive ? 'deactivated' : 'activated'}`,
        });
      } catch (e) {
        toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to update status', variant: 'destructive' });
      }
    },

    async resetPassword(target, password) {
      try {
        await AdminDomainService.resetPassword(target, password, callerEmail);
        toast({ title: 'Password Reset', description: `Password updated for ${target.name || target.email}` });
      } catch (e) {
        toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to reset password', variant: 'destructive' });
      }
    },

    async remove(target) {
      try {
        await AdminDomainService.remove(target, callerEmail);
        await load();
        toast({ title: 'Deleted', description: `${target.name || target.email} permanently deleted` });
      } catch (e) {
        toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to delete', variant: 'destructive' });
      }
    },
  };

  return { users, commissioners, superAdmins, stats, isLoading, refresh: load, actions };
}
