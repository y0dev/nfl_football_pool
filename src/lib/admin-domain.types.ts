export type AdminRole = 'SUPER_ADMIN' | 'COMMISSIONER';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
}

export interface AdminDomainStats {
  total: number;
  active: number;
  inactive: number;
  superAdmins: number;
  commissioners: number;
}
