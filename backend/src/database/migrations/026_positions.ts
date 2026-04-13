import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Positions1000000000026 implements MigrationInterface {
  name = 'Positions1000000000026';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Tabel jabatan/posisi pekerjaan (terpisah dari role sistem)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "positions" (
        "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
        "name"       VARCHAR(100)  NOT NULL,
        "created_at" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_positions_name"  UNIQUE ("name"),
        CONSTRAINT "PK_positions"       PRIMARY KEY ("id")
      )
    `);

    // FK position_id pada users (nullable — tidak wajib)
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "position_id" UUID,
        ADD CONSTRAINT "FK_users_position"
          FOREIGN KEY ("position_id")
          REFERENCES "positions"("id")
          ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_position"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN  IF EXISTS "position_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "positions"`);
  }
}
