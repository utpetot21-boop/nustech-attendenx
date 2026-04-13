import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { seedRoles } from './roles.seed';
import { seedAdminUser } from './admin-user.seed';
import { seedNationalHolidays } from './national-holidays.seed';
import { seedLeaveConfig } from './leave-config.seed';
import { seedTemplates } from './templates.seed';

async function run() {
  console.log('🌱 Menjalankan seeds...\n');

  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected\n');

    await seedRoles(AppDataSource);
    await seedAdminUser(AppDataSource);
    await seedNationalHolidays(AppDataSource);
    await seedLeaveConfig(AppDataSource);
    await seedTemplates(AppDataSource);

    console.log('\n🎉 Semua seeds selesai!');
    console.log('📝 Login: admin@nustech-attendenx.id / Admin@1234');
    console.log('⚠️  Ganti password saat first login!\n');
  } catch (error) {
    console.error('❌ Seed gagal:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

run();
