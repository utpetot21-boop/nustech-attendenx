import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanySettings1000000000012 implements MigrationInterface {
  name = 'CompanySettings1000000000012';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_attendance_config" (
        "id"                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "late_tolerance_minutes"  INTEGER     NOT NULL DEFAULT 60,
        "alfa_threshold_hours"    INTEGER     NOT NULL DEFAULT 4,
        "objection_window_hours"  INTEGER     NOT NULL DEFAULT 24,
        "effective_date"          DATE        NOT NULL DEFAULT CURRENT_DATE,
        "updated_by"              UUID        REFERENCES "users"("id") ON DELETE SET NULL,
        "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO "company_attendance_config"
        ("late_tolerance_minutes", "alfa_threshold_hours", "objection_window_hours")
      VALUES (60, 4, 24)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_profile" (
        "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"       VARCHAR(200) NOT NULL DEFAULT 'Nustech',
        "address"    TEXT        NOT NULL DEFAULT '',
        "phone"      VARCHAR(30) NOT NULL DEFAULT '',
        "email"      VARCHAR(150) NOT NULL DEFAULT '',
        "website"    VARCHAR(200) NOT NULL DEFAULT '',
        "logo_url"   TEXT,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO "company_profile" ("name") VALUES ('Nustech')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "backup_history" (
        "id"           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "type"         VARCHAR(20) NOT NULL DEFAULT 'full',
        "status"       VARCHAR(20) NOT NULL DEFAULT 'running',
        "size_bytes"   BIGINT,
        "file_path"    TEXT,
        "checksum"     VARCHAR(64),
        "error_msg"    TEXT,
        "started_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "finished_at"  TIMESTAMPTZ,
        "triggered_by" UUID REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_backup_history_started"
      ON "backup_history"("started_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "backup_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "company_profile"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "company_attendance_config"`);
  }
}
