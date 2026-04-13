import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpenseClaimsSos1000000000011 implements MigrationInterface {
  name = 'ExpenseClaimsSos1000000000011';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── Expense Claims ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "company_expense_config" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "category"        VARCHAR(30) NOT NULL UNIQUE,
        "max_amount"      INTEGER NOT NULL DEFAULT 0,
        "receipt_required_above" INTEGER NOT NULL DEFAULT 50000,
        "is_active"       BOOLEAN NOT NULL DEFAULT TRUE,
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO company_expense_config (category, max_amount, receipt_required_above)
      VALUES
        ('transport',   500000,  50000),
        ('parkir',      100000,  50000),
        ('material',   2000000, 100000),
        ('konsumsi',    150000,  50000),
        ('akomodasi',  1000000, 100000),
        ('lainnya',     500000,  50000)
    `);

    await queryRunner.query(`
      CREATE TABLE "expense_claims" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "claim_number"  VARCHAR(30) UNIQUE,
        "user_id"       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "visit_id"      UUID REFERENCES visits(id) ON DELETE SET NULL,
        "category"      VARCHAR(30) NOT NULL,
        "amount"        INTEGER NOT NULL,
        "description"   TEXT,
        "receipt_urls"  JSONB NOT NULL DEFAULT '[]',
        "status"        VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','paid')),
        "reviewer_id"   UUID REFERENCES users(id) ON DELETE SET NULL,
        "review_note"   TEXT,
        "reviewed_at"   TIMESTAMPTZ,
        "paid_at"       TIMESTAMPTZ,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "expense_claim_logs" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "claim_id"    UUID NOT NULL REFERENCES expense_claims(id) ON DELETE CASCADE,
        "actor_id"    UUID REFERENCES users(id) ON DELETE SET NULL,
        "action"      VARCHAR(30),
        "old_status"  VARCHAR(20),
        "new_status"  VARCHAR(20),
        "note"        TEXT,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_expense_claims_user ON expense_claims(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_expense_claims_status ON expense_claims(status)`);

    // Counter untuk nomor klaim (KC-YYYY/NNN)
    await queryRunner.query(`
      CREATE TABLE "claim_sequences" (
        "id"      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "year"    INTEGER NOT NULL UNIQUE,
        "seq"     INTEGER NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── SOS & Darurat ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "emergency_contacts" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"       VARCHAR(100) NOT NULL,
        "role"       VARCHAR(80),
        "phone"      VARCHAR(20) NOT NULL,
        "priority"   INTEGER NOT NULL DEFAULT 1,
        "is_active"  BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sos_alerts" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "activated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "resolved_at"     TIMESTAMPTZ,
        "last_lat"        DECIMAL(10,6),
        "last_lng"        DECIMAL(10,6),
        "last_address"    VARCHAR,
        "battery_pct"     INTEGER,
        "status"          VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','responded','resolved','cancelled')),
        "responded_by"    UUID REFERENCES users(id) ON DELETE SET NULL,
        "responded_at"    TIMESTAMPTZ,
        "notes"           TEXT,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sos_location_tracks" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "alert_id"   UUID NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE,
        "lat"        DECIMAL(10,6) NOT NULL,
        "lng"        DECIMAL(10,6) NOT NULL,
        "accuracy"   DECIMAL(6,2),
        "battery_pct" INTEGER,
        "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_sos_alerts_user ON sos_alerts(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_sos_alerts_status ON sos_alerts(status)`);
    await queryRunner.query(`CREATE INDEX idx_sos_tracks_alert ON sos_location_tracks(alert_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS sos_location_tracks`);
    await queryRunner.query(`DROP TABLE IF EXISTS sos_alerts`);
    await queryRunner.query(`DROP TABLE IF EXISTS emergency_contacts`);
    await queryRunner.query(`DROP TABLE IF EXISTS claim_sequences`);
    await queryRunner.query(`DROP TABLE IF EXISTS expense_claim_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS expense_claims`);
    await queryRunner.query(`DROP TABLE IF EXISTS company_expense_config`);
  }
}
