import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UsersRolesDepartments1000000000001 implements MigrationInterface {
  name = 'UsersRolesDepartments1000000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgcrypto untuk gen_random_uuid()
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ── roles ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"         VARCHAR(50) NOT NULL UNIQUE,
        "permissions"  JSONB,
        "can_delegate" BOOLEAN NOT NULL DEFAULT FALSE,
        "can_approve"  BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── departments ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"       VARCHAR(100) NOT NULL,
        "code"       VARCHAR(10)  UNIQUE,
        "manager_id" UUID,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── locations ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "locations" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"         VARCHAR(100) NOT NULL,
        "address"      TEXT,
        "lat"          DECIMAL(10,6) NOT NULL,
        "lng"          DECIMAL(10,6) NOT NULL,
        "radius_meter" INTEGER NOT NULL DEFAULT 100,
        "is_active"    BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);

    // ── users ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id"          VARCHAR(20)  NOT NULL UNIQUE,
        "name"                 VARCHAR(100) NOT NULL,
        "email"                VARCHAR(150) NOT NULL UNIQUE,
        "phone"                VARCHAR(20)  NOT NULL,
        "password_hash"        VARCHAR      NOT NULL,
        "role_id"              UUID         NOT NULL REFERENCES roles(id),
        "department_id"        UUID         REFERENCES departments(id) ON DELETE SET NULL,
        "location_id"          UUID         REFERENCES locations(id)   ON DELETE SET NULL,
        "schedule_type"        VARCHAR(20)  CHECK (schedule_type IN ('shift','office_hours')),
        "is_senior"            BOOLEAN      NOT NULL DEFAULT FALSE,
        "pin_hash"             VARCHAR,
        "avatar_url"           VARCHAR,
        "is_active"            BOOLEAN      NOT NULL DEFAULT TRUE,
        "must_change_password" BOOLEAN      NOT NULL DEFAULT TRUE,
        "last_login_at"        TIMESTAMPTZ,
        "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // FK manager_id setelah users dibuat
    await queryRunner.query(`
      ALTER TABLE "departments"
        ADD CONSTRAINT "fk_dept_manager"
        FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // ── refresh_tokens ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "token"       VARCHAR NOT NULL,
        "expires_at"  TIMESTAMPTZ NOT NULL,
        "revoked_at"  TIMESTAMPTZ,
        "device_info" JSONB,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── user_devices ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "user_devices" (
        "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "fcm_token"      VARCHAR NOT NULL,
        "device_name"    VARCHAR(100),
        "platform"       VARCHAR(10) NOT NULL CHECK (platform IN ('android','ios')),
        "app_version"    VARCHAR(20),
        "is_active"      BOOLEAN NOT NULL DEFAULT TRUE,
        "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, fcm_token)
      )
    `);

    // ── password_reset_tokens ────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "token_hash" VARCHAR NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at"    TIMESTAMPTZ,
        "channel"    VARCHAR(10) NOT NULL CHECK (channel IN ('email','whatsapp')),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── Indexes ──────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX "idx_users_email"       ON users(email)`);
    await queryRunner.query(`CREATE INDEX "idx_users_employee_id" ON users(employee_id)`);
    await queryRunner.query(`CREATE INDEX "idx_users_role_id"     ON users(role_id)`);
    await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_user" ON refresh_tokens(user_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_devices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "fk_dept_manager"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "locations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "departments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
  }
}
