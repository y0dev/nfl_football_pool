import { AdminRole, AdminUser } from './admin-domain.types';

export const AdminDomainRules = {
  label(role: AdminRole): string {
    return role === 'SUPER_ADMIN' ? 'Admin' : 'Commissioner';
  },

  canDelete(user: AdminUser): boolean {
    return user.role === 'COMMISSIONER';
  },

  canToggle(user: AdminUser): boolean {
    return user.role === 'COMMISSIONER';
  },

  passwordMinLength(): number {
    return 8;
  },

  validatePassword(password: string): string | null {
    if (password.length < AdminDomainRules.passwordMinLength()) {
      return `Password must be at least ${AdminDomainRules.passwordMinLength()} characters.`;
    }
    if (!/[A-Z]/.test(password)) return 'Must contain at least one uppercase letter.';
    if (!/[a-z]/.test(password)) return 'Must contain at least one lowercase letter.';
    if (!/[0-9]/.test(password)) return 'Must contain at least one number.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Must contain at least one special character.';
    return null;
  },

  toggleEndpoint(): string {
    return '/api/admin/toggle-status';
  },

  resetPasswordEndpoint(role: AdminRole): string {
    return role === 'SUPER_ADMIN'
      ? '/api/admin/reset-admin-password'
      : '/api/admin/reset-password';
  },

  deleteEndpoint(role: AdminRole): string {
    return role === 'SUPER_ADMIN'
      ? '/api/admin/delete-admin'
      : '/api/admin/delete-commissioner';
  },
};
