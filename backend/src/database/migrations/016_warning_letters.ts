import { MigrationInterface, QueryRunner } from 'typeorm';

export class WarningLetters1000000000016 implements MigrationInterface {
  name = 'WarningLetters1000000000016';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "warning_letters" (
        "id"                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"                 UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "level"                   VARCHAR(5) NOT NULL CHECK ("level" IN ('SP1','SP2','SP3')),
        "reason"                  TEXT NOT NULL,
        "reference_violation_id"  UUID REFERENCES "attendance_violations"("id") ON DELETE SET NULL,
        "issued_by"               UUID NOT NULL REFERENCES "users"("id"),
        "issued_at"               DATE NOT NULL DEFAULT CURRENT_DATE,
        "valid_until"             DATE,
        "acknowledged_by"         UUID REFERENCES "users"("id"),
        "acknowledged_at"         TIMESTAMPTZ,
        "doc_url"                 VARCHAR,
        "notes"                   TEXT,
        "created_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_warning_letters_user_id"    ON "warning_letters"("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_warning_letters_level"       ON "warning_letters"("level")`);
    await queryRunner.query(`CREATE INDEX "idx_warning_letters_issued_at"   ON "warning_letters"("issued_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "idx_warning_letters_unacknowledged" ON "warning_letters"("acknowledged_at") WHERE "acknowledged_at" IS NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "warning_letters"`);
  }
}
