import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnnouncementReadsHidden1000000000035 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE announcement_reads
        ADD COLUMN IF NOT EXISTS hidden_for_user BOOLEAN NOT NULL DEFAULT FALSE;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE announcement_reads DROP COLUMN IF EXISTS hidden_for_user;`);
  }
}
