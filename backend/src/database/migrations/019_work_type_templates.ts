import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkTypeTemplates1000000000019 implements MigrationInterface {
  name = 'WorkTypeTemplates1000000000019';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── work_type_templates ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE work_type_templates (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name          VARCHAR(100) NOT NULL,
        work_type     VARCHAR(100) NOT NULL,
        description   TEXT,
        is_active     BOOLEAN     NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // ── template_sections ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE template_sections (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID        NOT NULL REFERENCES work_type_templates(id) ON DELETE CASCADE,
        title       VARCHAR(100) NOT NULL,
        order_index INT         NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // ── template_fields ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE template_fields (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        section_id  UUID        NOT NULL REFERENCES template_sections(id) ON DELETE CASCADE,
        label       VARCHAR(100) NOT NULL,
        field_type  VARCHAR(30) NOT NULL,
        options     JSONB,
        is_required BOOLEAN     NOT NULL DEFAULT false,
        order_index INT         NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // ── template_photo_requirements ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE template_photo_requirements (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID        NOT NULL REFERENCES work_type_templates(id) ON DELETE CASCADE,
        phase       VARCHAR(30) NOT NULL,
        label       VARCHAR(100) NOT NULL,
        is_required BOOLEAN     NOT NULL DEFAULT true,
        max_photos  INT         NOT NULL DEFAULT 3,
        order_index INT         NOT NULL DEFAULT 0
      )
    `);

    // ── visit_form_responses ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE visit_form_responses (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        visit_id   UUID        NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
        field_id   UUID        NOT NULL REFERENCES template_fields(id),
        value      TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (visit_id, field_id)
      )
    `);

    // ── Add template_id FK to visits and tasks ──────────────────────────────
    await queryRunner.query(`
      ALTER TABLE visits ADD COLUMN template_id UUID REFERENCES work_type_templates(id)
    `);
    await queryRunner.query(`
      ALTER TABLE tasks ADD COLUMN template_id UUID REFERENCES work_type_templates(id)
    `);

    // ── Indexes ─────────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX idx_template_sections_template ON template_sections(template_id)`);
    await queryRunner.query(`CREATE INDEX idx_template_fields_section ON template_fields(section_id)`);
    await queryRunner.query(`CREATE INDEX idx_template_photo_req_template ON template_photo_requirements(template_id)`);
    await queryRunner.query(`CREATE INDEX idx_visit_form_responses_visit ON visit_form_responses(visit_id)`);
    await queryRunner.query(`CREATE INDEX idx_visits_template ON visits(template_id)`);
    await queryRunner.query(`CREATE INDEX idx_tasks_template ON tasks(template_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tasks DROP COLUMN IF EXISTS template_id`);
    await queryRunner.query(`ALTER TABLE visits DROP COLUMN IF EXISTS template_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS visit_form_responses`);
    await queryRunner.query(`DROP TABLE IF EXISTS template_photo_requirements`);
    await queryRunner.query(`DROP TABLE IF EXISTS template_fields`);
    await queryRunner.query(`DROP TABLE IF EXISTS template_sections`);
    await queryRunner.query(`DROP TABLE IF EXISTS work_type_templates`);
  }
}
