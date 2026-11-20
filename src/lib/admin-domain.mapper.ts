import { AdminUser } from './admin-domain.types';
import type { Admin } from './admin-service';

import { isPaidPlanCurrent } from './plan-season';

function planInfo(row: Admin) {
  const trialDate = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
  const isTrialActive = !!(trialDate && trialDate > new Date());
  const daysLeft = isTrialActive && trialDate
    ? Math.ceil((trialDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  // A Standard plan bought for an ended season shows as free.
  const storedPlan = isPaidPlanCurrent(row) ? (row.plan ?? 'free') : 'free';
  return { plan: isTrialActive ? 'standard' : storedPlan, isTrialActive, daysLeft };
}

export const AdminDomainMapper = {
  fromApi(row: Admin): AdminUser {
    const { plan, isTrialActive, daysLeft } = planInfo(row);
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
      billingExempt: row.billing_exempt ?? false,
    };
  },

  toList(rows: Admin[]): AdminUser[] {
    return rows.map(r => AdminDomainMapper.fromApi(r));
  },
};
