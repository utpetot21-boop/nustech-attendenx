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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AttendanceRequestsService } from './attendance-requests.service';
import { CreateAttendanceRequestDto } from './dto/create-attendance-request.dto';
import { ReviewAttendanceRequestDto } from './dto/review-attendance-request.dto';

@ApiTags('Attendance Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance-requests')
export class AttendanceRequestsController {
  constructor(private readonly service: AttendanceRequestsService) {}

  // ── Karyawan: submit permohonan ───────────────────────────────
  @Post()
  @ApiOperation({ summary: 'Ajukan izin terlambat atau izin pulang awal' })
  submit(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAttendanceRequestDto,
  ) {
    return this.service.submit(userId, dto);
  }

  // ── Karyawan: permohonan hari ini ─────────────────────────────
  @Get('my/today')
  @ApiOperation({ summary: 'Permohonan absensi saya hari ini' })
  getMyToday(@CurrentUser('id') userId: string) {
    return this.service.getMyToday(userId);
  }

  // ── Karyawan: riwayat permohonan ──────────────────────────────
  @Get('my')
  @ApiOperation({ summary: 'Riwayat permohonan absensi saya' })
  getMyRequests(
    @CurrentUser('id') userId: string,
    @Query('date') date?: string,
    @Query('type') type?: string,
  ) {
    return this.service.getMyRequests(userId, { date, type });
  }

  // ── Admin: jumlah pending (badge) ─────────────────────────────
  @Get('admin/pending-count')
  @RequirePermission('attendance:manage')
  @ApiOperation({ summary: 'Jumlah permohonan pending (untuk badge notif admin)' })
  getPendingCount() {
    return this.service.getPendingCount().then((count) => ({ count }));
  }

  // ── Admin: list semua permohonan ──────────────────────────────
  @Get('admin/list')
  @RequirePermission('attendance:manage')
  @ApiOperation({ summary: 'Daftar semua permohonan absensi (admin)' })
  getAdminList(
    @Query('status') status?: string,
    @Query('type')   type?: string,
    @Query('date')   date?: string,
    @Query('page')   page?: string,
  ) {
    return this.service.getAdminList({
      status,
      type,
      date,
      page: page ? parseInt(page) : 1,
    });
  }

  // ── Admin: approve ────────────────────────────────────────────
  @Post(':id/approve')
  @RequirePermission('attendance:manage')
  @ApiOperation({ summary: 'Setujui permohonan absensi' })
  approve(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAttendanceRequestDto,
  ) {
    return this.service.approve(adminId, id, dto);
  }

  // ── Admin: reject ─────────────────────────────────────────────
  @Post(':id/reject')
  @RequirePermission('attendance:manage')
  @ApiOperation({ summary: 'Tolak permohonan absensi' })
  reject(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAttendanceRequestDto,
  ) {
    return this.service.reject(adminId, id, dto);
  }
}
