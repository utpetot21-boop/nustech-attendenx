import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientsSla1000000000013 implements MigrationInterface {
  name = 'ClientsSla1000000000013';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN IF NOT EXISTS "contract_type"        VARCHAR(20)  NOT NULL DEFAULT 'regular',
        ADD COLUMN IF NOT EXISTS "contract_number"      VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "contract_start"       DATE,
        ADD COLUMN IF NOT EXISTS "contract_end"         DATE,
        ADD COLUMN IF NOT EXISTS "sla_response_hours"   INTEGER      NOT NULL DEFAULT 24,
        ADD COLUMN IF NOT EXISTS "sla_completion_hours" INTEGER      NOT NULL DEFAULT 48,
        ADD COLUMN IF NOT EXISTS "monthly_visit_quota"  INTEGER      NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "account_manager_id"   UUID         REFERENCES "users"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "contract_doc_url"     TEXT,
        ADD COLUMN IF NOT EXISTS "notes"                TEXT
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "client_sla_history" (
        "id"               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "client_id"        UUID        NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "month"            VARCHAR(7)  NOT NULL,
        "visits_count"     INTEGER     NOT NULL DEFAULT 0,
        "avg_response_hrs" DECIMAL(6,2),
        "avg_completion_hrs" DECIMAL(6,2),
        "breach_count"     INTEGER     NOT NULL DEFAULT 0,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_client_sla_month" ON "client_sla_history"("client_id", "month")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "client_sla_history"`);
    await queryRunner.query(`
      ALTER TABLE "clients"
        DROP COLUMN IF EXISTS "contract_type",
        DROP COLUMN IF EXISTS "contract_number",
        DROP COLUMN IF EXISTS "contract_start",
        DROP COLUMN IF EXISTS "contract_end",
        DROP COLUMN IF EXISTS "sla_response_hours",
        DROP COLUMN IF EXISTS "sla_completion_hours",
        DROP COLUMN IF EXISTS "monthly_visit_quota",
        DROP COLUMN IF EXISTS "account_manager_id",
        DROP COLUMN IF EXISTS "contract_doc_url",
        DROP COLUMN IF EXISTS "notes"
    `);
  }
}
