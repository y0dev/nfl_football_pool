export type AdminRole = 'SUPER_ADMIN' | 'COMMISSIONER';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
  plan: string;
  isTrialActive: boolean;
  daysLeft: number;
  /** Comped by the site admin — this account never has to pay for its plan. */
  billingExempt: boolean;
}

export interface AdminDomainStats {
  total: number;
  active: number;
  inactive: number;
  superAdmins: number;
  commissioners: number;
  byPlan: { free: number; standard: number; pro: number };
}
