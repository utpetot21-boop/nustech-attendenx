import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RolesIsSystem1000000000028 implements MigrationInterface {
  name = 'RolesIsSystem1000000000028';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tambah kolom is_system
    await queryRunner.query(`
      ALTER TABLE roles
      ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false
    `);

    // 2. Tandai 4 role sistem
    await queryRunner.query(`
      UPDATE roles
      SET is_system = true
      WHERE name IN ('super_admin', 'admin', 'manager', 'karyawan')
    `);

    // 3. Buat role karyawan jika belum ada
    await queryRunner.query(`
      INSERT INTO roles (name, permissions, can_delegate, can_approve, is_system)
      SELECT 'karyawan', '["attendance:own","task:own"]'::jsonb, false, false, true
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'karyawan')
    `);

    // 4. Pindahkan user dengan role lama (senior/junior/technician/hr) ke karyawan
    await queryRunner.query(`
      UPDATE users
      SET role_id = (SELECT id FROM roles WHERE name = 'karyawan')
      WHERE role_id IN (
        SELECT id FROM roles WHERE name IN ('senior', 'junior', 'technician', 'hr')
      )
    `);

    // 5. Hapus role lama yang tidak dipakai lagi
    await queryRunner.query(`
      DELETE FROM roles WHERE name IN ('senior', 'junior', 'technician', 'hr')
    `);

    // 6. Pindahkan user dari role duplikat (case-insensitive) ke system role yang sesuai
    await queryRunner.query(`
      UPDATE users u
      SET role_id = (
        SELECT id FROM roles r2
        WHERE LOWER(r2.name) = LOWER(r.name)
          AND r2.is_system = true
        LIMIT 1
      )
      FROM roles r
      WHERE u.role_id = r.id
        AND r.is_system = false
        AND EXISTS (
          SELECT 1 FROM roles r2
          WHERE LOWER(r2.name) = LOWER(r.name)
            AND r2.is_system = true
        )
    `);

    // 7. Hapus role non-sistem yang nama duplikat dengan system role
    await queryRunner.query(`
      DELETE FROM roles r
      WHERE r.is_system = false
        AND EXISTS (
          SELECT 1 FROM roles r2
          WHERE LOWER(r2.name) = LOWER(r.name)
            AND r2.is_system = true
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE roles DROP COLUMN IF EXISTS is_system`);
  }
}
