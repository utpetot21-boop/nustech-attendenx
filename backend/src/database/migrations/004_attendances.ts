import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Attendances1000000000004 implements MigrationInterface {
  name = 'Attendances1000000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attendances" (
        "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "user_schedule_id"     UUID REFERENCES user_schedules(id) ON DELETE SET NULL,
        "date"                 DATE NOT NULL,
        "schedule_type"        VARCHAR(20),
        "shift_start"          TIME,
        "shift_end"            TIME,
        "tolerance_minutes"    INTEGER NOT NULL DEFAULT 60,
        "check_in_at"          TIMESTAMPTZ,
        "check_in_method"      VARCHAR(20) CHECK (check_in_method IN ('face_id','fingerprint','pin','qr','gps')),
        "check_in_lat"         DECIMAL(10,6),
        "check_in_lng"         DECIMAL(10,6),
        "check_in_location_id" UUID REFERENCES locations(id) ON DELETE SET NULL,
        "check_out_at"         TIMESTAMPTZ,
        "check_out_method"     VARCHAR(10) CHECK (check_out_method IN ('manual','auto')),
        "checkout_earliest"    TIMESTAMPTZ,
        "status"               VARCHAR(20) NOT NULL DEFAULT 'alfa'
                               CHECK (status IN ('hadir','terlambat','alfa','izin','sakit','dinas')),
        "late_minutes"         INTEGER NOT NULL DEFAULT 0,
        "overtime_minutes"     INTEGER NOT NULL DEFAULT 0,
        "is_holiday_work"      BOOLEAN NOT NULL DEFAULT FALSE,
        "notes"                TEXT,
        "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, date)
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_attendances_user_date"  ON attendances(user_id, date)`);
    await queryRunner.query(`CREATE INDEX "idx_attendances_date"       ON attendances(date)`);
    await queryRunner.query(`CREATE INDEX "idx_attendances_status"     ON attendances(status)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "attendances"`);
  }
}
