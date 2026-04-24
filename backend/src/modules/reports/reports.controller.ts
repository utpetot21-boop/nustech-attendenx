import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import * as XLSX from 'xlsx';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { ExcelExportService } from './excel-export.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission('report:view')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly excel: ExcelExportService,
  ) {}

  private currentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  @Get('attendance')
  attendance(
    @Query('month') month: string,
    @Query('dept_id') deptId?: string,
    @Query('user_id') userId?: string,
  ) {
    return this.reports.getAttendanceReport({ month: month ?? this.currentMonth(), deptId, userId });
  }

  @Get('attendance/export/excel')
  async attendanceExcel(
    @Query('month') month: string,
    @Res() res: Response,
    @Query('dept_id') deptId?: string,
  ) {
    const rows = await this.reports.getAttendanceReport({ month: month ?? this.currentMonth(), deptId });
    const buf = this.excel.exportAttendance(rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="kehadiran-${month}.xlsx"`);
    res.send(buf);
  }

  @Get('visits/daily')
  visitsDailyStats(@Query('days') days?: string) {
    return this.reports.getVisitsDailyStats(days ? parseInt(days) : 7);
  }

  @Get('visits')
  visits(
    @Query('month') month: string,
    @Query('user_id') userId?: string,
    @Query('client_id') clientId?: string,
  ) {
    return this.reports.getVisitsReport({ month: month ?? this.currentMonth(), userId, clientId });
  }

  @Get('leave')
  leave(@Query('year') year?: string) {
    return this.reports.getLeaveReport(year ? parseInt(year) : new Date().getFullYear());
  }

  @Get('leave/export/excel')
  async leaveExcel(@Query('year') year: string, @Res() res: Response) {
    const rows = await this.reports.getLeaveReport(year ? parseInt(year) : new Date().getFullYear());
    const buf = this.excel.exportLeaveBalances(rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="saldo-cuti-${year}.xlsx"`);
    res.send(buf);
  }

  @Get('overtime')
  overtime(
    @Query('month') month: string,
    @Query('dept_id') deptId?: string,
  ) {
    return this.reports.getOvertimeReport({ month: month ?? this.currentMonth(), deptId });
  }

  @Get('overtime/export/excel')
  async overtimeExcel(@Query('month') month: string, @Res() res: Response) {
    const rows = await this.reports.getOvertimeReport({ month: month ?? this.currentMonth() });
    const buf = this.excel.exportOvertime(rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="lembur-${month}.xlsx"`);
    res.send(buf);
  }

  @Get('violations')
  violations(
    @Query('month') month?: string,
    @Query('user_id') userId?: string,
  ) {
    return this.reports.getViolationsReport({ month, userId });
  }

  // ── Combined Excel export ─────────────────────────────────────────────────
  @Get('export/excel')
  async exportExcel(
    @Query('month') month: string,
    @Query('year') year: string,
    @Res() res: Response,
  ) {
    const m = month ?? this.currentMonth();
    const y = year ? parseInt(year) : new Date().getFullYear();

    const [attendance, overtime, leave] = await Promise.all([
      this.reports.getAttendanceReport({ month: m }),
      this.reports.getOvertimeReport({ month: m }),
      this.reports.getLeaveReport(y),
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attendance), 'Kehadiran');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overtime), 'Lembur');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leave), 'Saldo Cuti');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="laporan-${m}.xlsx"`);
    res.send(buf);
  }

  // ── PDF export (HTML-based via basic template) ────────────────────────────
  @Get('export/pdf')
  async exportPdf(
    @Query('month') month: string,
    @Res() res: Response,
  ) {
    const m = month ?? this.currentMonth();
    const rows = await this.reports.getAttendanceReport({ month: m });

    const tableRows = rows.map((r: any) => `
      <tr>
        <td>${r.full_name ?? r.user_id}</td>
        <td>${r.department ?? '–'}</td>
        <td style="text-align:center">${r.hadir ?? 0}</td>
        <td style="text-align:center">${r.terlambat ?? 0}</td>
        <td style="text-align:center">${r.alfa ?? 0}</td>
        <td style="text-align:center">${r.izin ?? 0}</td>
        <td style="text-align:center">${Math.round((r.total_overtime_minutes ?? 0) / 60 * 10) / 10} jam</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  p.sub { color: #666; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #007AFF; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
  td { padding: 7px 10px; border-bottom: 0.5px solid #E5E7EB; }
  tr:nth-child(even) { background: #F9FAFB; }
  .footer { margin-top: 24px; font-size: 10px; color: #9CA3AF; }
</style>
</head>
<body>
  <h1>Laporan Kehadiran Karyawan</h1>
  <p class="sub">Periode: ${m} · Generated: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })} WITA</p>
  <table>
    <thead>
      <tr>
        <th>Nama Karyawan</th><th>Departemen</th><th>Hadir</th>
        <th>Terlambat</th><th>Alfa</th><th>Izin</th><th>Lembur</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <p class="footer">Nustech-AttendenX · Laporan ini dibuat secara otomatis oleh sistem</p>
</body>
</html>`;

    // Return as HTML that browsers can print-to-PDF
    // In production, use Puppeteer to convert to actual PDF
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="laporan-${m}.pdf"`);
    res.send(html);
  }
}
