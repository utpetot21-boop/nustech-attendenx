import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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

import { ScheduleSwapService } from './schedule-swap.service';
import { CreateSwapRequestDto } from './dto/create-swap-request.dto';
import { RespondSwapDto } from './dto/respond-swap.dto';

@ApiTags('Schedule Swap')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('schedule-swap')
export class ScheduleSwapController {
  constructor(private readonly swapService: ScheduleSwapService) {}

  /** Karyawan: ajukan permintaan tukar jadwal */
  @Post('requests')
  @ApiOperation({ summary: 'Ajukan permintaan tukar jadwal' })
  createRequest(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSwapRequestDto,
  ) {
    return this.swapService.createRequest(userId, dto);
  }

  /** List request (karyawan lihat milik sendiri, admin lihat semua) */
  @Get('requests')
  @ApiOperation({ summary: 'Daftar permintaan tukar jadwal' })
  getRequests(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('user_id') queryUserId?: string,
  ) {
    const isAdmin = ['admin', 'super_admin', 'manager'].includes(role);
    return this.swapService.getRequests({
      userId: isAdmin && queryUserId ? queryUserId : isAdmin ? undefined : userId,
      status,
      isAdmin,
      page: page ? parseInt(page) : 1,
    });
  }

  /** Target user: setujui atau tolak permintaan */
  @Post('requests/:id/respond')
  @ApiOperation({ summary: 'Target user merespons permintaan tukar jadwal' })
  respond(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RespondSwapDto,
  ) {
    return this.swapService.respondRequest(id, userId, dto);
  }

  /** Admin: setujui → eksekusi tukar jadwal */
  @Post('requests/:id/approve')
  @UseGuards(RolesGuard)
  @RequirePermission('schedule:manage')
  @ApiOperation({ summary: 'Admin menyetujui tukar jadwal' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.swapService.approveRequest(id, adminId);
  }

  /** Admin: tolak */
  @Post('requests/:id/reject')
  @UseGuards(RolesGuard)
  @RequirePermission('schedule:manage')
  @ApiOperation({ summary: 'Admin menolak tukar jadwal' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body('reason') reason: string,
  ) {
    return this.swapService.rejectRequest(id, adminId, reason);
  }

  /** Requester: batalkan sebelum dieksekusi */
  @Post('requests/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Batalkan permintaan tukar jadwal' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.swapService.cancelRequest(id, userId);
  }
}
