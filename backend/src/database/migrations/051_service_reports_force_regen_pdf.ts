import { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceReportsForceRegenPdf1000000000051 implements MigrationInterface {
  name = 'ServiceReportsForceRegenPdf1000000000051';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Hapus pdf_url lama agar PDF di-regenerate dengan layout foto per requirement template
    await queryRunner.query(`
      UPDATE service_reports
      SET pdf_url          = NULL,
          pdf_generated_at = NULL
      WHERE is_locked = TRUE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Tidak bisa restore URL lama — intentionally no-op
  }
}
