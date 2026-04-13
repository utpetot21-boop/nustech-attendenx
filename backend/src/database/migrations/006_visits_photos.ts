import type { MigrationInterface, QueryRunner } from 'typeorm';

export class VisitsPhotos1000000000006 implements MigrationInterface {
  name = 'VisitsPhotos1000000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "visits" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id"             UUID,
        "user_id"             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "client_id"           UUID NOT NULL REFERENCES clients(id),
        "check_in_at"         TIMESTAMPTZ,
        "check_in_lat"        DECIMAL(10,6),
        "check_in_lng"        DECIMAL(10,6),
        "check_in_address"    VARCHAR,
        "check_in_district"   VARCHAR,
        "check_in_province"   VARCHAR,
        "gps_valid"           BOOLEAN NOT NULL DEFAULT FALSE,
        "gps_deviation_meter" INTEGER,
        "check_out_at"        TIMESTAMPTZ,
        "work_description"    TEXT,
        "findings"            TEXT,
        "recommendations"     TEXT,
        "materials_used"      JSONB,
        "status"              VARCHAR(20) NOT NULL DEFAULT 'ongoing',
        "route_polyline"      TEXT,
        "duration_minutes"    INTEGER,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "visit_photos" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "visit_id"        UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
        "phase"           VARCHAR(10) NOT NULL CHECK (phase IN ('before','during','after')),
        "seq_number"      INTEGER,
        "original_url"    VARCHAR NOT NULL,
        "thumbnail_url"   VARCHAR,
        "watermarked_url" VARCHAR NOT NULL,
        "caption"         VARCHAR(255),
        "taken_at"        TIMESTAMPTZ NOT NULL,
        "lat"             DECIMAL(10,6),
        "lng"             DECIMAL(10,6),
        "district"        VARCHAR,
        "province"        VARCHAR,
        "file_size_kb"    INTEGER,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_visits_user_id"   ON visits(user_id)`);
    await queryRunner.query(`CREATE INDEX "idx_visits_client_id" ON visits(client_id)`);
    await queryRunner.query(`CREATE INDEX "idx_visits_status"    ON visits(status)`);
    await queryRunner.query(`CREATE INDEX "idx_visit_photos_visit" ON visit_photos(visit_id, phase)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "visit_photos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "visits"`);
  }
}
