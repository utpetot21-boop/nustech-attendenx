import { MigrationInterface, QueryRunner } from 'typeorm';

export class VisitPhotosRequirementId1000000000037 implements MigrationInterface {
  name = 'VisitPhotosRequirementId1000000000037';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "visit_photos"
        ADD COLUMN IF NOT EXISTS "photo_requirement_id" UUID
          REFERENCES "template_photo_requirements"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_visit_photos_requirement_id"
        ON "visit_photos" ("photo_requirement_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_visit_photos_requirement_id"`);
    await queryRunner.query(`
      ALTER TABLE "visit_photos" DROP COLUMN IF EXISTS "photo_requirement_id"
    `);
  }
}
