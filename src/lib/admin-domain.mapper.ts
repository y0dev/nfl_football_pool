import { AdminUser } from './admin-domain.types';
import { Admin } from './admin-service';

export const AdminDomainMapper = {
  fromApi(row: Admin): AdminUser {
    return {
      id: row.id,
      name: row.full_name || '',
      email: row.email,
      role: row.is_super_admin ? 'SUPER_ADMIN' : 'COMMISSIONER',
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  },

  toList(rows: Admin[]): AdminUser[] {
    return rows.map(r => AdminDomainMapper.fromApi(r));
  },
};
