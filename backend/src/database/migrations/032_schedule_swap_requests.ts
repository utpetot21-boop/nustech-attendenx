import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScheduleSwapRequests1000000000032 implements MigrationInterface {
  name = 'ScheduleSwapRequests1000000000032';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "schedule_swap_requests" (
        "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "requester_id"         UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "target_user_id"       UUID          REFERENCES "users"("id") ON DELETE SET NULL,
        "type"                 VARCHAR(20)  NOT NULL CHECK ("type" IN ('with_person','with_own_dayoff')),
        "requester_date"       DATE         NOT NULL,
        "target_date"          DATE         NOT NULL,
        "requester_shift_id"   UUID          REFERENCES "shift_types"("id") ON DELETE SET NULL,
        "target_shift_id"      UUID          REFERENCES "shift_types"("id") ON DELETE SET NULL,
        "status"               VARCHAR(20)  NOT NULL DEFAULT 'pending_target'
                                 CHECK ("status" IN ('pending_target','pending_admin','approved','rejected','cancelled')),
        "notes"                TEXT,
        "reject_reason"        TEXT,
        "approved_by"          UUID          REFERENCES "users"("id") ON DELETE SET NULL,
        "target_responded_at"  TIMESTAMPTZ,
        "admin_responded_at"   TIMESTAMPTZ,
        "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_swap_requester"   ON "schedule_swap_requests" ("requester_id");
      CREATE INDEX "idx_swap_target"      ON "schedule_swap_requests" ("target_user_id");
      CREATE INDEX "idx_swap_status"      ON "schedule_swap_requests" ("status");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule_swap_requests"`);
  }
}
