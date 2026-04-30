import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}

  // ── Attendance ───────────────────────────────────────────────────────────────
  async getAttendanceReport(filters: {
    month: string; // YYYY-MM
    deptId?: string;
    userId?: string;
  }) {
    const [year, month] = filters.month.split('-').map(Number);

    let sql = `
      SELECT
        u.id AS user_id,
        u.full_name,
        d.name AS department,
        COUNT(*) FILTER (WHERE a.status = 'hadir')    AS hadir,
        COUNT(*) FILTER (WHERE a.status = 'terlambat') AS terlambat,
        COUNT(*) FILTER (WHERE a.status = 'alfa')      AS alfa,
        COUNT(*) FILTER (WHERE a.status IN ('izin','sakit','dinas')) AS izin,
        COALESCE(SUM(a.overtime_minutes), 0) AS total_overtime_minutes
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN attendances a
        ON a.user_id = u.id
        AND EXTRACT(YEAR  FROM a.date::date) = $1
        AND EXTRACT(MONTH FROM a.date::date) = $2
      WHERE u.is_active = true
    `;

    const params: (string | number)[] = [year, month];

    if (filters.deptId) {
      params.push(filters.deptId);
      sql += ` AND u.department_id = $${params.length}`;
    }
    if (filters.userId) {
      params.push(filters.userId);
      sql += ` AND u.id = $${params.length}`;
    }

    sql += ' GROUP BY u.id, u.full_name, d.name ORDER BY d.name, u.full_name';

    return this.ds.query(sql, params);
  }

  // ── Visits ───────────────────────────────────────────────────────────────────
  async getVisitsReport(filters: { month: string; userId?: string; clientId?: string }) {
    const [year, month] = filters.month.split('-').map(Number);

    let sql = `
      SELECT
        u.full_name AS technician,
        c.name AS client,
        COUNT(v.id) AS total_visits,
        COUNT(v.id) FILTER (WHERE v.status = 'completed') AS completed,
        ROUND(AVG(v.duration_minutes))  AS avg_duration_minutes,
        COUNT(vp.id) AS total_photos
      FROM visits v
      JOIN users u ON v.user_id = u.id
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN visit_photos vp ON vp.visit_id = v.id
      WHERE EXTRACT(YEAR  FROM v.check_in_at) = $1
        AND EXTRACT(MONTH FROM v.check_in_at) = $2
    `;

    const params: (string | number)[] = [year, month];

    if (filters.userId) { params.push(filters.userId); sql += ` AND v.user_id = $${params.length}`; }
    if (filters.clientId) { params.push(filters.clientId); sql += ` AND v.client_id = $${params.length}`; }

    sql += ' GROUP BY u.full_name, c.name ORDER BY total_visits DESC';
    return this.ds.query(sql, params);
  }

  // ── Visits daily (for dashboard chart) ───────────────────────────────────────
  async getVisitsDailyStats(days = 7): Promise<{ date: string; total: number; completed: number }[]> {
    return this.ds.query(
      `SELECT
         TO_CHAR(v.check_in_at::date, 'YYYY-MM-DD') AS date,
         COUNT(v.id)::int AS total,
         COUNT(v.id) FILTER (WHERE v.status = 'completed')::int AS completed
       FROM visits v
       WHERE v.check_in_at >= NOW() - ($1 || ' days')::interval
       GROUP BY v.check_in_at::date
       ORDER BY v.check_in_at::date ASC`,
      [days],
    );
  }

  // ── Leave ────────────────────────────────────────────────────────────────────
  async getLeaveReport(year: number) {
    return this.ds.query(
      `SELECT
         u.full_name, d.name AS department,
         lb.balance_days, lb.used_days, lb.accrued_monthly,
         lb.accrued_holiday, lb.expired_days, lb.year
       FROM leave_balances lb
       JOIN users u ON lb.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE lb.year = $1
       ORDER BY d.name, u.full_name`,
      [year],
    );
  }

  // ── Overtime ─────────────────────────────────────────────────────────────────
  async getOvertimeReport(filters: { month: string; deptId?: string }) {
    const [year, month] = filters.month.split('-').map(Number);

    let sql = `
      SELECT
        u.id AS user_id,
        u.full_name,
        d.name AS department,
        COUNT(*) FILTER (WHERE a.overtime_minutes > 0) AS overtime_days,
        COALESCE(SUM(a.overtime_minutes), 0) AS total_minutes,
        ROUND(COALESCE(SUM(a.overtime_minutes), 0) / 60.0, 2) AS total_hours
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN attendances a
        ON a.user_id = u.id
        AND EXTRACT(YEAR  FROM a.date::date) = $1
        AND EXTRACT(MONTH FROM a.date::date) = $2
        AND a.overtime_minutes > 0
      WHERE u.is_active = true
    `;

    const params: (string | number)[] = [year, month];
    if (filters.deptId) { params.push(filters.deptId); sql += ` AND u.department_id = $${params.length}`; }

    sql += ` GROUP BY u.id, u.full_name, d.name
             HAVING COALESCE(SUM(a.overtime_minutes), 0) > 0
             ORDER BY total_minutes DESC`;

    return this.ds.query(sql, params);
  }

  // ── Violations ───────────────────────────────────────────────────────────────
  async getViolationsReport(filters: { month?: string; userId?: string }) {
    let sql = `
      SELECT
        u.full_name,
        av.type,
        av.description,
        av.is_resolved,
        av.created_at
      FROM attendance_violations av
      JOIN users u ON av.user_id = u.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (filters.month) {
      const [y, m] = filters.month.split('-').map(Number);
      params.push(y); sql += ` AND EXTRACT(YEAR  FROM av.created_at) = $${params.length}`;
      params.push(m); sql += ` AND EXTRACT(MONTH FROM av.created_at) = $${params.length}`;
    }
    if (filters.userId) { params.push(filters.userId); sql += ` AND av.user_id = $${params.length}`; }

    sql += ' ORDER BY av.created_at DESC LIMIT 200';
    return this.ds.query(sql, params);
  }
}
