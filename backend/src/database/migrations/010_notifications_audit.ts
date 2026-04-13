import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationsAudit1000000000010 implements MigrationInterface {
  name = 'NotificationsAudit1000000000010';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "type"       VARCHAR(30),
        "title"      VARCHAR(200),
        "body"       TEXT,
        "data"       JSONB,
        "channel"    VARCHAR(20) CHECK (channel IN ('push','whatsapp','email','in_app')),
        "is_read"    BOOLEAN NOT NULL DEFAULT FALSE,
        "read_at"    TIMESTAMPTZ,
        "sent_at"    TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"     UUID REFERENCES users(id) ON DELETE SET NULL,
        "action"      VARCHAR(100),
        "entity_type" VARCHAR(50),
        "entity_id"   UUID,
        "old_data"    JSONB,
        "new_data"    JSONB,
        "ip_address"  VARCHAR,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_notifications_user"    ON notifications(user_id, is_read)`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_user"       ON audit_logs(user_id)`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_entity"     ON audit_logs(entity_type, entity_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
  }
}
