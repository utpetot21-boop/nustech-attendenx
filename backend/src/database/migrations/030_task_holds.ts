import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskHolds1000000000030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_holds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        visit_id UUID REFERENCES visits(id),
        held_by UUID NOT NULL REFERENCES users(id),
        reason_type VARCHAR(30) NOT NULL,
        reason_notes TEXT NOT NULL,
        evidence_urls JSONB NOT NULL DEFAULT '[]',
        held_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_by UUID REFERENCES users(id),
        review_status VARCHAR(20) NOT NULL DEFAULT 'pending',
        reviewed_at TIMESTAMPTZ,
        reject_reason TEXT,
        reschedule_date DATE,
        reschedule_note TEXT,
        auto_approve_at TIMESTAMPTZ,
        is_auto_approved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_task_holds_task_id ON task_holds(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_holds_held_by ON task_holds(held_by);
      CREATE INDEX IF NOT EXISTS idx_task_holds_review_status ON task_holds(review_status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS task_holds;`);
  }
}
