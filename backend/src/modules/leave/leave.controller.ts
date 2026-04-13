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

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LeaveService } from './leave.service';
import { LeaveConfigService } from './leave-config.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveDto } from './dto/review-leave.dto';
import { CreateObjectionDto } from './dto/create-objection.dto';

@UseGuards(JwtAuthGuard)
@Controller('leave')
export class LeaveController {
  constructor(
    private readonly leave: LeaveService,
    private readonly config: LeaveConfigService,
  ) {}

  // ── Config ───────────────────────────────────────────────────────────────────
  @Get('config')
  getConfig() {
    return this.config.getConfig();
  }

  // ── Balance ──────────────────────────────────────────────────────────────────
  @Get('balance/me')
  getMyBalance(@CurrentUser('id') userId: string, @Query('year') year?: string) {
    return this.leave.getBalance(userId, year ? parseInt(year) : undefined);
  }

  @Get('balance/me/logs')
  getMyLogs(@CurrentUser('id') userId: string) {
    return this.leave.getBalanceLogs(userId);
  }

  @Get('balance/:userId')
  @UseGuards(RolesGuard)
  @RequirePermission('leave:approve')
  getBalance(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('year') year?: string,
  ) {
    return this.leave.getBalance(userId, year ? parseInt(year) : undefined);
  }

  @Get('balance/:userId/logs')
  @UseGuards(RolesGuard)
  @RequirePermission('leave:approve')
  getLogs(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.leave.getBalanceLogs(userId);
  }

  // ── Requests ─────────────────────────────────────────────────────────────────
  @Post('requests')
  createRequest(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leave.createRequest(userId, dto);
  }

  @Get('requests')
  getRequests(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('user_id') queryUserId?: string,
  ) {
    const isAdmin = ['admin', 'manager'].includes(role);
    return this.leave.getRequests({
      userId: isAdmin && queryUserId ? queryUserId : isAdmin ? undefined : userId,
      status,
      page: page ? parseInt(page) : 1,
    });
  }

  @Post('requests/:id/approve')
  @UseGuards(RolesGuard)
  @RequirePermission('leave:approve')
  approveRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') managerId: string,
  ) {
    return this.leave.approveRequest(id, managerId);
  }

  @Post('requests/:id/reject')
  @UseGuards(RolesGuard)
  @RequirePermission('leave:approve')
  rejectRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') managerId: string,
    @Body() dto: RejectLeaveDto,
  ) {
    return this.leave.rejectRequest(id, managerId, dto);
  }

  // ── Objections ───────────────────────────────────────────────────────────────
  @Post('objections')
  createObjection(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateObjectionDto,
  ) {
    return this.leave.createObjection(userId, dto);
  }

  @Get('objections')
  getObjections(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    const isAdmin = ['admin', 'manager'].includes(role);
    return this.leave.getObjections(isAdmin ? undefined : userId);
  }

  @Post('objections/:id/approve')
  @UseGuards(RolesGuard)
  @RequirePermission('leave:approve')
  approveObjection(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') managerId: string,
  ) {
    return this.leave.approveObjection(id, managerId);
  }

  @Post('objections/:id/reject')
  @UseGuards(RolesGuard)
  @RequirePermission('leave:approve')
  rejectObjection(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') managerId: string,
    @Body('reason') reason: string,
  ) {
    return this.leave.rejectObjection(id, managerId, reason);
  }
}
