import { AdminDomainMapper } from './admin-domain.mapper';
import { AdminDomainRules } from './admin-domain.rules';
import { AdminUser } from './admin-domain.types';

async function apiFetch(endpoint: string, method: string, body: object, callerEmail: string) {
  const res = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Email': callerEmail },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || `Request to ${endpoint} failed`);
  return data;
}

export const AdminDomainService = {
  async fetchAll(): Promise<AdminUser[]> {
    const res = await fetch('/api/super-admin/admins');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to load users');
    return AdminDomainMapper.toList(data.admins);
  },

  async toggle(user: AdminUser, callerEmail: string): Promise<void> {
    if (!AdminDomainRules.canToggle(user)) {
      throw new Error('Super admin accounts cannot be toggled.');
    }
    await apiFetch(
      AdminDomainRules.toggleEndpoint(),
      'POST',
      { adminId: user.id, isActive: !user.isActive },
      callerEmail,
    );
  },

  async resetPassword(user: AdminUser, password: string, callerEmail: string): Promise<void> {
    const err = AdminDomainRules.validatePassword(password);
    if (err) throw new Error(err);
    await apiFetch(
      AdminDomainRules.resetPasswordEndpoint(user.role),
      'POST',
      { adminId: user.id, newPassword: password },
      callerEmail,
    );
  },

  async remove(user: AdminUser, callerEmail: string): Promise<void> {
    if (!AdminDomainRules.canDelete(user)) {
      throw new Error('Super admin accounts cannot be deleted.');
    }
    await apiFetch(
      AdminDomainRules.deleteEndpoint(user.role),
      'DELETE',
      { adminId: user.id },
      callerEmail,
    );
  },
};
