import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Performance indexes — wajib untuk production (lihat Section 16.5.12)
 */
export class PerformanceIndexes1000000000015 implements MigrationInterface {
  name = 'PerformanceIndexes1000000000015';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Attendances
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendances_user_date"     ON "attendances"("user_id", "date")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendances_date"          ON "attendances"("date")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_attendances_status"        ON "attendances"("status")`);

    // User schedules
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_schedules_user_date"  ON "user_schedules"("user_id", "date")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_schedules_date"       ON "user_schedules"("date")`);

    // Visits
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_visits_user_id"            ON "visits"("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_visits_status"             ON "visits"("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_visits_created_at"         ON "visits"("created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_visits_client_id"          ON "visits"("client_id")`);

    // Visit photos
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_visit_photos_visit_phase"  ON "visit_photos"("visit_id", "phase")`);

    // Tasks
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_tasks_status"              ON "tasks"("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_tasks_assigned_to"         ON "tasks"("assigned_to")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_tasks_priority"            ON "tasks"("priority")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_tasks_client_id"           ON "tasks"("client_id")`);

    // Notifications
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_notifications_user_read"   ON "notifications"("user_id", "is_read")`);

    // Leave
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_leave_requests_user_status" ON "leave_requests"("user_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_leave_balance_logs_user"    ON "leave_balance_logs"("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_pending_deductions_status"  ON "pending_deductions"("status", "deadline_at")`);

    // Audit logs
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity"         ON "audit_logs"("entity_type", "entity_id")`);

    // National holidays
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_national_holidays_date"    ON "national_holidays"("date")`);

    // Expense claims
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_expense_claims_user_id"    ON "expense_claims"("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_expense_claims_status"     ON "expense_claims"("status")`);

    // SOS
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sos_alerts_user_status"    ON "sos_alerts"("user_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sos_tracks_alert_id"       ON "sos_location_tracks"("alert_id", "recorded_at" DESC)`);

    // Service reports
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_service_reports_visit_id"  ON "service_reports"("visit_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_service_reports_status"    ON "service_reports"("is_locked")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const indexes = [
      'idx_attendances_user_date', 'idx_attendances_date', 'idx_attendances_status',
      'idx_user_schedules_user_date', 'idx_user_schedules_date',
      'idx_visits_user_id', 'idx_visits_status', 'idx_visits_created_at', 'idx_visits_client_id',
      'idx_visit_photos_visit_phase',
      'idx_tasks_status', 'idx_tasks_assigned_to', 'idx_tasks_priority', 'idx_tasks_client_id',
      'idx_notifications_user_read',
      'idx_leave_requests_user_status', 'idx_leave_balance_logs_user', 'idx_pending_deductions_status',
      'idx_audit_logs_entity', 'idx_national_holidays_date',
      'idx_expense_claims_user_id', 'idx_expense_claims_status',
      'idx_sos_alerts_user_status', 'idx_sos_tracks_alert_id',
      'idx_service_reports_visit_id', 'idx_service_reports_status',
    ];
    for (const idx of indexes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${idx}"`);
    }
  }
}
