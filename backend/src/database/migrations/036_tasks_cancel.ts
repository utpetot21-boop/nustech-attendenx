import { MigrationInterface, QueryRunner } from 'typeorm';

export class TasksCancel1000000000036 implements MigrationInterface {
  name = 'TasksCancel1000000000036';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
        ADD COLUMN IF NOT EXISTS "cancelled_at"   TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "cancelled_by"   UUID REFERENCES "users"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "cancel_reason"  TEXT
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_cancelled_at" ON "tasks" ("cancelled_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tasks_cancelled_at"`);
    await queryRunner.query(`
      ALTER TABLE "tasks"
        DROP COLUMN IF EXISTS "cancel_reason",
        DROP COLUMN IF EXISTS "cancelled_by",
        DROP COLUMN IF EXISTS "cancelled_at"
    `);
  }
}
