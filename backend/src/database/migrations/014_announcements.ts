import { MigrationInterface, QueryRunner } from 'typeorm';

export class Announcements1000000000014 implements MigrationInterface {
  name = 'Announcements1000000000014';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "announcements" (
        "id"              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "title"           VARCHAR(255) NOT NULL,
        "body"            TEXT         NOT NULL,
        "type"            VARCHAR(20)  NOT NULL DEFAULT 'info',
        "target_type"     VARCHAR(20)  NOT NULL DEFAULT 'all',
        "target_dept_id"  UUID         REFERENCES "departments"("id") ON DELETE SET NULL,
        "target_user_ids" UUID[],
        "is_pinned"       BOOLEAN      NOT NULL DEFAULT false,
        "pinned_until"    DATE,
        "send_push"       BOOLEAN      NOT NULL DEFAULT true,
        "send_whatsapp"   BOOLEAN      NOT NULL DEFAULT false,
        "attachment_url"  TEXT,
        "status"          VARCHAR(20)  NOT NULL DEFAULT 'draft',
        "sent_at"         TIMESTAMPTZ,
        "created_by"      UUID         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "announcement_reads" (
        "id"              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "announcement_id" UUID        NOT NULL REFERENCES "announcements"("id") ON DELETE CASCADE,
        "user_id"         UUID        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "read_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE("announcement_id", "user_id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ann_status" ON "announcements"("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ann_reads_ann" ON "announcement_reads"("announcement_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ann_reads_user" ON "announcement_reads"("user_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "announcement_reads"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "announcements"`);
  }
}
