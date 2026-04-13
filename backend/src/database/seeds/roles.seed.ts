import type { DataSource } from 'typeorm';

import { ROLE_PERMISSIONS } from '@nustech/shared';
import { RoleEntity } from '../../modules/roles/entities/role.entity';

const SYSTEM_ROLES = [
  {
    name: 'super_admin',
    permissions: ROLE_PERMISSIONS.super_admin,
    can_delegate: true,
    can_approve: true,
    is_system: true,
  },
  {
    name: 'admin',
    permissions: ROLE_PERMISSIONS.admin,
    can_delegate: false,
    can_approve: true,
    is_system: true,
  },
  {
    name: 'manager',
    permissions: ROLE_PERMISSIONS.manager,
    can_delegate: true,
    can_approve: true,
    is_system: true,
  },
  {
    name: 'karyawan',
    permissions: ROLE_PERMISSIONS.karyawan,
    can_delegate: false,
    can_approve: false,
    is_system: true,
  },
];

export async function seedRoles(dataSource: DataSource): Promise<void> {
  const roleRepo = dataSource.getRepository(RoleEntity);

  for (const roleData of SYSTEM_ROLES) {
    const existing = await roleRepo.findOne({ where: { name: roleData.name as 'admin' } });
    if (existing) {
      // Update permissions & flags agar selalu sinkron dengan kode
      await roleRepo.update(existing.id, {
        permissions: roleData.permissions,
        can_delegate: roleData.can_delegate,
        can_approve: roleData.can_approve,
        is_system: true,
      });
      console.log(`🔄 Role updated: ${roleData.name}`);
    } else {
      await roleRepo.save(roleRepo.create(roleData as Partial<RoleEntity>));
      console.log(`✅ Role seeded: ${roleData.name}`);
    }
  }
}
