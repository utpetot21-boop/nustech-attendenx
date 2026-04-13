import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropIsSenior1000000000027 implements MigrationInterface {
  name = 'DropIsSenior1000000000027';

  async up(queryRunner: QueryRunner): Promise<void> {
    // is_senior adalah field redundan — role.name === 'senior' sudah cukup
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_senior"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_senior" BOOLEAN NOT NULL DEFAULT FALSE`);
  }
}
