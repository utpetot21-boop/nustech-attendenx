import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserDevicesDedupeToken1000000000038 implements MigrationInterface {
  name = 'UserDevicesDedupeToken1000000000038';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Cleanup data legacy: kalau satu fcm_token aktif di banyak user_id,
    // matikan semua kecuali baris yang paling terakhir aktif.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY fcm_token
            ORDER BY last_active_at DESC NULLS LAST, created_at DESC
          ) AS rn
        FROM user_devices
        WHERE is_active = true
      )
      UPDATE user_devices
      SET is_active = false
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    `);

    // Index parsial agar lookup sendToUser cepat
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_devices_active_token"
        ON "user_devices" ("fcm_token") WHERE is_active = true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_devices_active_token"`);
  }
}
