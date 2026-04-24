import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceCheckoutGps1000000000039 implements MigrationInterface {
  name = 'AttendanceCheckoutGps1000000000039';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendances"
        ADD COLUMN IF NOT EXISTS "check_out_lat"       DECIMAL(10,6) NULL,
        ADD COLUMN IF NOT EXISTS "check_out_lng"       DECIMAL(10,6) NULL,
        ADD COLUMN IF NOT EXISTS "check_out_gps_valid" BOOLEAN       NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendances"
        DROP COLUMN IF EXISTS "check_out_lat",
        DROP COLUMN IF EXISTS "check_out_lng",
        DROP COLUMN IF EXISTS "check_out_gps_valid"
    `);
  }
}
