import { AdminUser } from './admin-domain.types';
import type { Admin } from './admin-service';

function planInfo(rawPlan: string | null | undefined, trialEndsAt: string | null | undefined) {
  const trialDate = trialEndsAt ? new Date(trialEndsAt) : null;
  const isTrialActive = !!(trialDate && trialDate > new Date());
  const daysLeft = isTrialActive && trialDate
    ? Math.ceil((trialDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  return { plan: isTrialActive ? 'standard' : (rawPlan ?? 'free'), isTrialActive, daysLeft };
}

export const AdminDomainMapper = {
  fromApi(row: Admin): AdminUser {
    const { plan, isTrialActive, daysLeft } = planInfo(row.plan, row.trial_ends_at);
    return {
      id: row.id,
      name: row.full_name || '',
      email: row.email,
      role: row.is_super_admin ? 'SUPER_ADMIN' : 'COMMISSIONER',
      isActive: row.is_active,
      createdAt: row.created_at,
      plan,
      isTrialActive,
      daysLeft,
    };
  },

  toList(rows: Admin[]): AdminUser[] {
    return rows.map(r => AdminDomainMapper.fromApi(r));
  },
};
