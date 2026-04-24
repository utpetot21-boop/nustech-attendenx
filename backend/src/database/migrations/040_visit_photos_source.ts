import { MigrationInterface, QueryRunner } from 'typeorm';

export class VisitPhotosSource1000000000040 implements MigrationInterface {
  name = 'VisitPhotosSource1000000000040';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "visit_photos"
        ADD COLUMN IF NOT EXISTS "source" VARCHAR(10) NOT NULL DEFAULT 'camera'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "visit_photos" DROP COLUMN IF EXISTS "source"
    `);
  }
}
