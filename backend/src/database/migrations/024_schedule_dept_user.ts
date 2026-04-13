import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ScheduleDeptUser1000000000024 implements MigrationInterface {
  name = 'ScheduleDeptUser1000000000024';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Tambah schedule_type ke departments
    await queryRunner.query(`
      ALTER TABLE "departments"
        ADD COLUMN IF NOT EXISTS "schedule_type" VARCHAR(20)
          CHECK ("schedule_type" IN ('shift', 'office_hours'))
    `);

    // Tambah default_shift_type_id ke users
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "default_shift_type_id" UUID
          REFERENCES "shift_types"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "default_shift_type_id"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "schedule_type"`);
  }
}
