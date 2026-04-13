import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessTrips1000000000018 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE business_trip_status AS ENUM (
        'draft', 'pending_approval', 'approved', 'rejected',
        'ongoing', 'completed', 'cancelled'
      );

      CREATE TABLE "business_trips" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "trip_number"         VARCHAR(30) NOT NULL UNIQUE,
        "user_id"             UUID NOT NULL REFERENCES "users"("id"),
        "approved_by"         UUID REFERENCES "users"("id"),
        "destination"         VARCHAR(255) NOT NULL,
        "purpose"             TEXT NOT NULL,
        "depart_date"         DATE NOT NULL,
        "return_date"         DATE NOT NULL,
        "status"              business_trip_status NOT NULL DEFAULT 'draft',
        "transport_mode"      VARCHAR(50),
        "estimated_cost"      NUMERIC(12,2),
        "actual_cost"         NUMERIC(12,2),
        "advance_amount"      NUMERIC(12,2),
        "doc_url"             VARCHAR(500),
        "rejection_reason"    TEXT,
        "notes"               TEXT,
        "approved_at"         TIMESTAMPTZ,
        "departed_at"         TIMESTAMPTZ,
        "returned_at"         TIMESTAMPTZ,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX idx_business_trips_user ON "business_trips"("user_id");
      CREATE INDEX idx_business_trips_status ON "business_trips"("status");
      CREATE INDEX idx_business_trips_depart ON "business_trips"("depart_date");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "business_trips";
      DROP TYPE IF EXISTS business_trip_status;
    `);
  }
}
