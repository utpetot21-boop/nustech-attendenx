import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../users/entities/user.entity';
import { AttendanceRequestsService } from './attendance-requests.service';
import { CreateAttendanceRequestDto } from './dto/create-attendance-request.dto';
import { ReviewAttendanceRequestDto } from './dto/review-attendance-request.dto';

const APPROVER_POSITIONS = ['DIREKTUR', 'DIREKTUR UTAMA'];

function isAttendanceApprover(user: UserEntity): boolean {
  if (user.role?.permissions?.includes('attendance:manage')) return true;
  if (APPROVER_POSITIONS.includes((user.position?.name ?? '').toUpperCase())) return true;
  return false;
}

@ApiTags('Attendance Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  @ApiOperation({ summary: 'Jumlah permohonan pending (untuk badge notif admin)' })
  getPendingCount(@CurrentUser() user: UserEntity) {
    if (!isAttendanceApprover(user)) throw new ForbiddenException('Akses ditolak');
    return this.service.getPendingCount().then((count) => ({ count }));
  }

  // ── Admin: list semua permohonan ──────────────────────────────
  @Get('admin/list')
  @ApiOperation({ summary: 'Daftar semua permohonan absensi (admin)' })
  getAdminList(
    @CurrentUser() user: UserEntity,
    @Query('status') status?: string,
    @Query('type')   type?: string,
    @Query('date')   date?: string,
    @Query('page')   page?: string,
  ) {
    if (!isAttendanceApprover(user)) throw new ForbiddenException('Akses ditolak');
    return this.service.getAdminList({
      status,
      type,
      date,
      page: page ? parseInt(page) : 1,
    });
  }

  // ── Admin: approve ────────────────────────────────────────────
  @Post(':id/approve')
  @ApiOperation({ summary: 'Setujui permohonan absensi' })
  approve(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAttendanceRequestDto,
  ) {
    if (!isAttendanceApprover(user)) throw new ForbiddenException('Akses ditolak');
    return this.service.approve(user.id, id, dto);
  }

  // ── Admin: reject ─────────────────────────────────────────────
  @Post(':id/reject')
  @ApiOperation({ summary: 'Tolak permohonan absensi' })
  reject(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAttendanceRequestDto,
  ) {
    if (!isAttendanceApprover(user)) throw new ForbiddenException('Akses ditolak');
    return this.service.reject(user.id, id, dto);
  }
}
