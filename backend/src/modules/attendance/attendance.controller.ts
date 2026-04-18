import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  // ── Check-In ──────────────────────────────────────────────────
  @Post('check-in')
  @ApiOperation({ summary: 'Check-in absensi kantor (biometrik/PIN/QR)' })
  checkIn(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.attendanceService.checkIn(userId, dto);
  }

  // ── Check-Out ─────────────────────────────────────────────────
  @Post('check-out')
  @ApiOperation({ summary: 'Check-out (dikunci sampai 8 jam sejak check-in)' })
  checkOut(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckOutDto,
  ) {
    return this.attendanceService.checkOut(userId, dto);
  }

  // ── Absensi hari ini (my own) ─────────────────────────────────
  @Get('today')
  @ApiOperation({ summary: 'Absensi hari ini milik saya' })
  getMyToday(@CurrentUser('id') userId: string) {
    return this.attendanceService.getToday(userId);
  }

  // ── Checkout info (untuk countdown timer) ────────────────────
  @Get('checkout-info')
  @ApiOperation({ summary: 'Info checkout: canCheckout, remainingSeconds' })
  getCheckoutInfo(@CurrentUser('id') userId: string) {
    return this.attendanceService.getCheckoutInfo(userId);
  }

  // ── Koordinat kantor efektif untuk user (geofence display) ───
  @Get('my-office')
  @ApiOperation({ summary: 'Koordinat & radius kantor efektif user (personal > global)' })
  getMyOffice(@CurrentUser('id') userId: string) {
    return this.attendanceService.getMyOffice(userId);
  }

  // ── Absensi hari ini user tertentu (admin/manager) ────────────
  @Get('today/:userId')
  @RequirePermission('attendance:manage')
  @ApiOperation({ summary: 'Absensi hari ini user tertentu (admin/manager)' })
  getTodayByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.attendanceService.getToday(userId);
  }

  // ── Riwayat absensi ───────────────────────────────────────────
  @Get('history')
  @ApiOperation({ summary: 'Riwayat absensi saya' })
  @ApiQuery({ name: 'month', required: false, example: '2025-04' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getHistory(
    @CurrentUser('id') userId: string,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.getHistory(userId, { month, from, to });
  }

  // ── Ringkasan hari ini (web dashboard) ────────────────────────
  @Get('summary/today')
  @RequirePermission('attendance:manage')
  @ApiOperation({ summary: 'Ringkasan kehadiran hari ini (untuk dashboard web)' })
  getSummaryToday() {
    return this.attendanceService.getSummaryToday();
  }

  // ── Admin: daftar absensi semua karyawan ─────────────────────
  @Get('admin/list')
  @RequirePermission('attendance:manage')
  @ApiOperation({ summary: 'Daftar absensi semua karyawan (admin)' })
  getAttendanceList(
    @Query('date') date?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.getAttendanceList({ date, month, status });
  }

  // ── Laporan ───────────────────────────────────────────────────
  @Get('report')
  @RequirePermission('attendance:manage')
  @ApiOperation({ summary: 'Laporan absensi (filter month/dept)' })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'userId', required: false })
  getReport(
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
  ) {
    if (userId) {
      return this.attendanceService.getHistory(userId, { month, from, to });
    }
    return this.attendanceService.getSummaryToday();
  }
}
