import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceReports1000000000007 implements MigrationInterface {
  name = 'ServiceReports1000000000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "service_reports" (
        "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "visit_id"              UUID NOT NULL UNIQUE REFERENCES visits(id) ON DELETE CASCADE,
        "report_number"         VARCHAR(30) UNIQUE,
        "technician_id"         UUID NOT NULL REFERENCES users(id),
        "client_id"             UUID NOT NULL REFERENCES clients(id),
        "client_pic_name"       VARCHAR,
        "tech_signature_url"    VARCHAR,
        "client_signature_url"  VARCHAR,
        "client_signature_type" VARCHAR(20) CHECK (client_signature_type IN ('digital','photo_upload')),
        "signed_at"             TIMESTAMPTZ,
        "pdf_url"               VARCHAR,
        "pdf_generated_at"      TIMESTAMPTZ,
        "is_locked"             BOOLEAN NOT NULL DEFAULT FALSE,
        "sent_to_client"        BOOLEAN NOT NULL DEFAULT FALSE,
        "sent_at"               TIMESTAMPTZ,
        "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Counter nomor BA thread-safe
    await queryRunner.query(`
      CREATE TABLE "report_sequences" (
        "id"      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "year"    INTEGER NOT NULL,
        "month"   INTEGER NOT NULL,
        "seq"     INTEGER NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(year, month)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_sequences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_reports"`);
  }
}
