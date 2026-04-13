import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnnouncementsExpiresAt1000000000017 implements MigrationInterface {
  name = 'AnnouncementsExpiresAt1000000000017';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ann_expires_at" ON "announcements"("expires_at") WHERE "expires_at" IS NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ann_expires_at"`);
    await queryRunner.query(`ALTER TABLE "announcements" DROP COLUMN IF EXISTS "expires_at"`);
  }
}
