import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceRequests1000000000033 implements MigrationInterface {
  name = 'AttendanceRequests1000000000033';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── Tabel permohonan absensi (izin terlambat & izin pulang awal) ──
    await queryRunner.query(`
      CREATE TABLE "attendance_requests" (
        "id"              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"         UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "date"            DATE        NOT NULL,
        "type"            VARCHAR(20) NOT NULL
                            CHECK ("type" IN ('late_arrival', 'early_departure')),
        "reason"          TEXT        NOT NULL,
        "estimated_time"  TIME,
        "status"          VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK ("status" IN ('pending','approved','rejected','cancelled')),
        "reviewed_by"     UUID        REFERENCES "users"("id") ON DELETE SET NULL,
        "reviewer_note"   TEXT,
        "reviewed_at"     TIMESTAMPTZ,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_att_req_user_date" ON "attendance_requests" ("user_id", "date");
      CREATE INDEX "idx_att_req_status"    ON "attendance_requests" ("status");
    `);

    // ── Tambah flag ke tabel attendances ──────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "attendances"
        ADD COLUMN "late_approved"             BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN "early_departure_approved"  BOOLEAN NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendances"
        DROP COLUMN IF EXISTS "late_approved",
        DROP COLUMN IF EXISTS "early_departure_approved"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_requests"`);
  }
}
