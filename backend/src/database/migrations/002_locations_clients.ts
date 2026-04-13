import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LocationsClients1000000000002 implements MigrationInterface {
  name = 'LocationsClients1000000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "clients" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"         VARCHAR(150) NOT NULL,
        "pic_name"     VARCHAR(100),
        "pic_phone"    VARCHAR(20),
        "pic_email"    VARCHAR(150),
        "address"      TEXT,
        "lat"          DECIMAL(10,6),
        "lng"          DECIMAL(10,6),
        "radius_meter" INTEGER NOT NULL DEFAULT 200,
        "is_active"    BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_clients_name" ON clients(name)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "clients"`);
  }
}
