import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsersRenameNameToFullName1000000000022 implements MigrationInterface {
  name = 'UsersRenameNameToFullName1000000000022';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users RENAME COLUMN "name" TO "full_name"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users RENAME COLUMN "full_name" TO "name"
    `);
  }
}
