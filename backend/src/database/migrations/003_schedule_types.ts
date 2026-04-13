import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ScheduleTypes1000000000003 implements MigrationInterface {
  name = 'ScheduleTypes1000000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── shift_types ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "shift_types" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"             VARCHAR(50) NOT NULL,
        "start_time"       TIME NOT NULL,
        "end_time"         TIME NOT NULL,
        "duration_minutes" INTEGER NOT NULL,
        "tolerance_minutes" INTEGER NOT NULL DEFAULT 60,
        "color_hex"        VARCHAR(7) NOT NULL DEFAULT '#007AFF',
        "department_id"    UUID REFERENCES departments(id) ON DELETE SET NULL,
        "is_active"        BOOLEAN NOT NULL DEFAULT TRUE,
        "created_by"       UUID REFERENCES users(id) ON DELETE SET NULL,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "chk_shift_duration_480"
          CHECK (duration_minutes = 480)
      )
    `);

    // ── office_hours_config ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "office_hours_config" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"          UUID REFERENCES users(id) ON DELETE CASCADE,
        "department_id"    UUID REFERENCES departments(id) ON DELETE CASCADE,
        "start_time"       TIME NOT NULL,
        "end_time"         TIME NOT NULL,
        "duration_minutes" INTEGER NOT NULL,
        "work_days"        JSONB NOT NULL DEFAULT '["Mon","Tue","Wed","Thu","Fri"]',
        "tolerance_minutes" INTEGER NOT NULL DEFAULT 60,
        "effective_date"   DATE NOT NULL,
        "created_by"       UUID REFERENCES users(id) ON DELETE SET NULL,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "chk_oh_duration_480"
          CHECK (duration_minutes = 480)
      )
    `);

    // ── user_schedules ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "user_schedules" (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "shift_type_id"     UUID REFERENCES shift_types(id) ON DELETE SET NULL,
        "schedule_type"     VARCHAR(20),
        "date"              DATE NOT NULL,
        "start_time"        TIME NOT NULL,
        "end_time"          TIME NOT NULL,
        "tolerance_minutes" INTEGER NOT NULL DEFAULT 60,
        "is_holiday"        BOOLEAN NOT NULL DEFAULT FALSE,
        "is_day_off"        BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, date)
      )
    `);

    // ── national_holidays ────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "national_holidays" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "date"                DATE NOT NULL UNIQUE,
        "name"                VARCHAR(100) NOT NULL,
        "year"                INTEGER NOT NULL,
        "is_active"           BOOLEAN NOT NULL DEFAULT TRUE,
        "is_collective_leave" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_by"          UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // ── company_leave_config ─────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "company_leave_config" (
        "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "max_leave_days_per_year"  INTEGER NOT NULL DEFAULT 12,
        "monthly_accrual_amount"   DECIMAL(3,1) NOT NULL DEFAULT 1.0,
        "holiday_work_credit"      DECIMAL(3,1) NOT NULL DEFAULT 1.0,
        "alfa_deduction_amount"    DECIMAL(3,1) NOT NULL DEFAULT 1.0,
        "objection_window_hours"   INTEGER NOT NULL DEFAULT 24,
        "expiry_reminder_days"     JSONB NOT NULL DEFAULT '[30, 7]',
        "effective_date"           DATE NOT NULL DEFAULT CURRENT_DATE,
        "updated_by"               UUID REFERENCES users(id) ON DELETE SET NULL,
        "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_user_schedules_user_date" ON user_schedules(user_id, date)`);
    await queryRunner.query(`CREATE INDEX "idx_national_holidays_year"   ON national_holidays(year)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "company_leave_config"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "national_holidays"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_schedules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "office_hours_config"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shift_types"`);
  }
}
