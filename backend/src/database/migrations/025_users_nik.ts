import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UsersNik1000000000025 implements MigrationInterface {
  name = 'UsersNik1000000000025';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "nik" VARCHAR(20) UNIQUE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "nik"`);
  }
}
