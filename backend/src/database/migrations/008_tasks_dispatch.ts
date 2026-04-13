import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TasksDispatch1000000000008 implements MigrationInterface {
  name = 'TasksDispatch1000000000008';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title"            VARCHAR(200) NOT NULL,
        "description"      TEXT,
        "type"             VARCHAR(30),
        "priority"         VARCHAR(10) NOT NULL DEFAULT 'normal'
                           CHECK (priority IN ('low','normal','high','urgent')),
        "status"           VARCHAR(20) NOT NULL DEFAULT 'unassigned',
        "client_id"        UUID REFERENCES clients(id) ON DELETE SET NULL,
        "location_id"      UUID REFERENCES locations(id) ON DELETE SET NULL,
        "assigned_to"      UUID REFERENCES users(id) ON DELETE SET NULL,
        "created_by"       UUID NOT NULL REFERENCES users(id),
        "dispatch_type"    VARCHAR(10) CHECK (dispatch_type IN ('direct','broadcast')),
        "broadcast_dept_id" UUID REFERENCES departments(id) ON DELETE SET NULL,
        "confirm_deadline" TIMESTAMPTZ,
        "scheduled_at"     TIMESTAMPTZ,
        "completed_at"     TIMESTAMPTZ,
        "is_emergency"     BOOLEAN NOT NULL DEFAULT FALSE,
        "notes"            TEXT,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "task_assignments" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id"       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        "user_id"       UUID NOT NULL REFERENCES users(id),
        "status"        VARCHAR(20) NOT NULL
                        CHECK (status IN ('offered','accepted','rejected','auto_assigned')),
        "offered_at"    TIMESTAMPTZ NOT NULL,
        "responded_at"  TIMESTAMPTZ,
        "reject_reason" TEXT,
        "is_current"    BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // FK tasks.task_id di visits (dibuat setelah tasks table ada)
    await queryRunner.query(`
      ALTER TABLE "visits"
        ADD CONSTRAINT "fk_visits_task_id"
        FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`CREATE INDEX "idx_tasks_assigned_to" ON tasks(assigned_to)`);
    await queryRunner.query(`CREATE INDEX "idx_tasks_status"      ON tasks(status)`);
    await queryRunner.query(`CREATE INDEX "idx_tasks_priority"    ON tasks(priority)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "visits" DROP CONSTRAINT IF EXISTS "fk_visits_task_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks"`);
  }
}
