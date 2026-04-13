import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceGpsValid1000000000021 implements MigrationInterface {
  name = 'AttendanceGpsValid1000000000021';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendances
        ADD COLUMN IF NOT EXISTS gps_valid BOOLEAN DEFAULT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendances DROP COLUMN IF EXISTS gps_valid
    `);
  }
}
