import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../../services/storage.service';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LeaveService } from './leave.service';
import { LeaveConfigService } from './leave-config.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveDto } from './dto/review-leave.dto';
import { CreateObjectionDto } from './dto/create-objection.dto';
import { UserEntity } from '../users/entities/user.entity';

const APPROVER_ROLES = ['admin', 'manager', 'super_admin', 'direktur', 'direktur utama'];

@UseGuards(JwtAuthGuard)
@Controller('leave')
export class LeaveController {
  constructor(
    private readonly leave: LeaveService,
    private readonly config: LeaveConfigService,
    private readonly storage: StorageService,
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

  @Get('balances')
  @UseGuards(RolesGuard)
  @RequirePermission('leave:approve')
  getAllBalances(@Query('year') year?: string) {
    return this.leave.getAllBalances(year ? parseInt(year) : undefined);
  }

  @Post('balance/:userId/adjust')
  @UseGuards(RolesGuard)
  @RequirePermission('leave:approve')
  manualAdjust(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: { amount: number; notes: string; year?: number },
  ) {
    return this.leave.manualAdjust(userId, dto.amount, dto.notes, dto.year);
  }

  @Delete('balance/log/:logId')
  @UseGuards(RolesGuard)
  @RequirePermission('leave:approve')
  deleteLog(@Param('logId', ParseUUIDPipe) logId: string) {
    return this.leave.deleteLog(logId);
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

  // ── Upload Attachment ────────────────────────────────────────────────────────
  @Post('requests/upload-attachment')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const url = await this.storage.upload('leave/attachments', ext, file.buffer, file.mimetype);
    return { url };
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
    @CurrentUser() user: UserEntity,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('user_id') queryUserId?: string,
  ) {
    const isApprover = !!user.role?.can_approve
      || APPROVER_ROLES.includes((user.role?.name ?? '').toLowerCase());
    return this.leave.getRequests({
      userId: isApprover && queryUserId ? queryUserId : isApprover ? undefined : user.id,
      status,
      page: page ? parseInt(page) : 1,
    });
  }

  @Post('requests/:id/approve')
  approveRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserEntity,
  ) {
    const canApprove = !!user.role?.can_approve
      || !!user.role?.permissions?.includes('leave:approve')
      || APPROVER_ROLES.includes((user.role?.name ?? '').toLowerCase());
    if (!canApprove) throw new ForbiddenException('Akses ditolak');
    return this.leave.approveRequest(id, user.id);
  }

  @Post('requests/:id/reject')
  rejectRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: RejectLeaveDto,
  ) {
    const canApprove = !!user.role?.can_approve
      || !!user.role?.permissions?.includes('leave:approve')
      || APPROVER_ROLES.includes((user.role?.name ?? '').toLowerCase());
    if (!canApprove) throw new ForbiddenException('Akses ditolak');
    return this.leave.rejectRequest(id, user.id, dto);
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
  getObjections(@CurrentUser() user: UserEntity) {
    const isApprover = !!user.role?.can_approve
      || APPROVER_ROLES.includes((user.role?.name ?? '').toLowerCase());
    return this.leave.getObjections(isApprover ? undefined : user.id);
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
