import * as bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';

import { RoleEntity } from '../../modules/roles/entities/role.entity';
import { UserEntity } from '../../modules/users/entities/user.entity';

export async function seedAdminUser(dataSource: DataSource): Promise<void> {
  const userRepo = dataSource.getRepository(UserEntity);
  const roleRepo = dataSource.getRepository(RoleEntity);

  const existing = await userRepo.findOne({
    where: { email: 'admin@nustech-attendenx.id' },
  });

  if (existing) {
    console.log('ℹ️  Admin user sudah ada, skip');
    return;
  }

  const adminRole = await roleRepo.findOne({ where: { name: 'admin' } });
  if (!adminRole) {
    throw new Error('Role admin belum di-seed. Jalankan roles.seed.ts terlebih dahulu.');
  }

  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  const admin = userRepo.create({
    employee_id: 'ADM-001',
    full_name: 'Administrator',
    email: 'admin@nustech-attendenx.id',
    phone: '08100000000',
    password_hash: passwordHash,
    role_id: adminRole.id,
    is_active: true,
    must_change_password: true, // Wajib ganti password saat first login
    schedule_type: 'office_hours',
  });

  await userRepo.save(admin);
  console.log('✅ Admin user seeded: admin@nustech-attendenx.id / Admin@1234');
  console.log('⚠️  Ganti password saat first login!');
}
