import { MigrationInterface, QueryRunner } from 'typeorm';

export class VisitPhotoFeedback1000000000050 implements MigrationInterface {
  name = 'VisitPhotoFeedback1000000000050';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "visit_photos"
        ADD COLUMN IF NOT EXISTS "admin_feedback" TEXT,
        ADD COLUMN IF NOT EXISTS "needs_retake"   BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "feedback_by"    UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "feedback_at"    TIMESTAMPTZ
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "visit_photos"
        DROP COLUMN IF EXISTS "admin_feedback",
        DROP COLUMN IF EXISTS "needs_retake",
        DROP COLUMN IF EXISTS "feedback_by",
        DROP COLUMN IF EXISTS "feedback_at"
    `);
  }
}
