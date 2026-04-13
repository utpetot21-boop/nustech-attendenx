import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UsersGender1000000000029 implements MigrationInterface {
  name = 'UsersGender1000000000029';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS gender VARCHAR(10) NULL
        CONSTRAINT users_gender_check CHECK (gender IN ('male', 'female'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS gender`);
  }
}
