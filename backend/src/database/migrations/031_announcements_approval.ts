import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnnouncementsApproval1000000000031 implements MigrationInterface {
  name = 'AnnouncementsApproval1000000000031';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "announcements"
        ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT,
        ADD COLUMN IF NOT EXISTS "approved_by"      UUID REFERENCES "users"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "approved_at"      TIMESTAMPTZ
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "announcements"
        DROP COLUMN IF EXISTS "rejection_reason",
        DROP COLUMN IF EXISTS "approved_by",
        DROP COLUMN IF EXISTS "approved_at"
    `);
  }
}
