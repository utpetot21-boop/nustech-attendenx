import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LeaveSystem1000000000005 implements MigrationInterface {
  name = 'LeaveSystem1000000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "leave_balances" (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "year"              INTEGER NOT NULL,
        "balance_days"      DECIMAL(5,1) NOT NULL DEFAULT 0,
        "accrued_monthly"   INTEGER NOT NULL DEFAULT 0,
        "accrued_holiday"   INTEGER NOT NULL DEFAULT 0,
        "used_days"         DECIMAL(5,1) NOT NULL DEFAULT 0,
        "expired_days"      DECIMAL(5,1) NOT NULL DEFAULT 0,
        "last_accrual_month" INTEGER,
        "last_accrual_date" DATE,
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, year)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_requests" (
        "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "type"           VARCHAR(20) NOT NULL CHECK (type IN ('cuti','izin','sakit','dinas')),
        "start_date"     DATE NOT NULL,
        "end_date"       DATE NOT NULL,
        "total_days"     INTEGER,
        "reason"         TEXT,
        "attachment_url" VARCHAR,
        "status"         VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','rejected')),
        "approved_by"    UUID REFERENCES users(id) ON DELETE SET NULL,
        "approved_at"    TIMESTAMPTZ,
        "reject_reason"  TEXT,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_balance_logs" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "type"         VARCHAR(30) NOT NULL,
        "amount"       DECIMAL(5,1) NOT NULL,
        "balance_after" DECIMAL(5,1) NOT NULL,
        "reference_id" UUID,
        "notes"        VARCHAR,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "pending_deductions" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "attendance_id" UUID NOT NULL REFERENCES attendances(id),
        "amount"        DECIMAL(3,1) NOT NULL DEFAULT 1.0,
        "status"        VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','executed','auto_executed','cancelled')),
        "deadline_at"   TIMESTAMPTZ NOT NULL,
        "executed_at"   TIMESTAMPTZ,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_objections" (
        "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "pending_deduction_id" UUID NOT NULL REFERENCES pending_deductions(id),
        "user_id"              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "reason"               TEXT NOT NULL,
        "evidence_url"         VARCHAR,
        "status"               VARCHAR(20) NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','approved','rejected')),
        "reviewed_by"          UUID REFERENCES users(id) ON DELETE SET NULL,
        "reviewed_at"          TIMESTAMPTZ,
        "reject_reason"        TEXT,
        "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "attendance_violations" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "attendance_id"   UUID NOT NULL REFERENCES attendances(id),
        "type"            VARCHAR(30) NOT NULL DEFAULT 'alfa_no_balance',
        "description"     TEXT,
        "balance_at_time" DECIMAL(5,1) NOT NULL DEFAULT 0,
        "is_resolved"     BOOLEAN NOT NULL DEFAULT FALSE,
        "resolved_by"     UUID REFERENCES users(id) ON DELETE SET NULL,
        "resolved_at"     TIMESTAMPTZ,
        "resolution_notes" TEXT,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_leave_requests_user"   ON leave_requests(user_id)`);
    await queryRunner.query(`CREATE INDEX "idx_leave_requests_status" ON leave_requests(status)`);
    await queryRunner.query(`CREATE INDEX "idx_leave_balances_user"   ON leave_balances(user_id, year)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_violations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_objections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pending_deductions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_balance_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_balances"`);
  }
}
