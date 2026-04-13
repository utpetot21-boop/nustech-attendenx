import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceRadius1000000000023 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    // Tambah kolom radius ke company_attendance_config
    await qr.query(`
      ALTER TABLE company_attendance_config
        ADD COLUMN IF NOT EXISTS check_in_radius_meter INTEGER NOT NULL DEFAULT 100,
        ADD COLUMN IF NOT EXISTS office_lat NUMERIC(10,6),
        ADD COLUMN IF NOT EXISTS office_lng NUMERIC(10,6);
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE company_attendance_config
        DROP COLUMN IF EXISTS check_in_radius_meter,
        DROP COLUMN IF EXISTS office_lat,
        DROP COLUMN IF EXISTS office_lng;
    `);
  }
}
