import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Delegations1000000000009 implements MigrationInterface {
  name = 'Delegations1000000000009';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "delegations" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id"      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        "from_user_id" UUID NOT NULL REFERENCES users(id),
        "to_user_id"   UUID NOT NULL REFERENCES users(id),
        "type"         VARCHAR(10) CHECK (type IN ('delegate','swap')),
        "reason"       TEXT NOT NULL,
        "status"       VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','accepted','rejected','expired')),
        "approved_by"  UUID REFERENCES users(id) ON DELETE SET NULL,
        "approved_at"  TIMESTAMPTZ,
        "reject_reason" TEXT,
        "swap_task_id" UUID REFERENCES tasks(id) ON DELETE SET NULL,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "delegations"`);
  }
}
