import { MigrationInterface, QueryRunner } from 'typeorm';

export class SlaAndScheduleLogs1000000000020 implements MigrationInterface {
  name = 'SlaAndScheduleLogs1000000000020';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── sla_breaches (Table 24) ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE sla_breaches (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        visit_id     UUID        NOT NULL REFERENCES visits(id),
        client_id    UUID        NOT NULL REFERENCES clients(id),
        breach_type  VARCHAR(20) NOT NULL,
        sla_hours    INT         NOT NULL,
        actual_hours INT         NOT NULL,
        breached_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        notes        TEXT
      )
    `);

    // ── schedule_change_logs (Table 50) ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE schedule_change_logs (
        id                UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id           UUID  NOT NULL REFERENCES users(id),
        changed_by        UUID  NOT NULL REFERENCES users(id),
        date              DATE  NOT NULL,
        old_shift_type_id UUID  REFERENCES shift_types(id),
        new_shift_type_id UUID  REFERENCES shift_types(id),
        reason            TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_sla_breaches_client ON sla_breaches(client_id)`);
    await queryRunner.query(`CREATE INDEX idx_sla_breaches_visit ON sla_breaches(visit_id)`);
    await queryRunner.query(`CREATE INDEX idx_schedule_change_logs_user ON schedule_change_logs(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_schedule_change_logs_date ON schedule_change_logs(date)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS schedule_change_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS sla_breaches`);
  }
}
