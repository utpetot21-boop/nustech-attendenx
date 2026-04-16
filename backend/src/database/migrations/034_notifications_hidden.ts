import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationsHidden1000000000034 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS hidden_for_user BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    // Index agar query filter cepat
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_hidden
        ON notifications (user_id, hidden_for_user);
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS idx_notifications_hidden;`);
    await qr.query(`ALTER TABLE notifications DROP COLUMN IF EXISTS hidden_for_user;`);
  }
}
