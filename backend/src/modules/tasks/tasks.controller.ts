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
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { RejectTaskDto } from './dto/accept-reject-task.dto';
import { DelegateTaskDto } from './dto/delegate-task.dto';
import { HandoverTaskDto } from './dto/handover-task.dto';
import { SwapRequestDto } from './dto/swap-request.dto';
import { HoldTaskDto } from './dto/hold-task.dto';
import { ApproveHoldDto, RejectHoldDto } from './dto/review-hold.dto';
import { CancelTaskDto } from './dto/cancel-task.dto';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  // ── LIST ─────────────────────────────────────────────────────────────────────
  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isAdmin = ['admin', 'super_admin', 'manager'].includes(role);
    return this.tasks.findAll({
      userId: isAdmin ? undefined : userId,
      status,
      priority,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('on-hold')
  @UseGuards(RolesGuard)
  @RequirePermission('task:assign')
  getOnHold() {
    return this.tasks.getOnHoldTasks();
  }

  @Get('rescheduled')
  @UseGuards(RolesGuard)
  @RequirePermission('task:assign')
  getRescheduled() {
    return this.tasks.getRescheduledTasks();
  }

  @Get('delegations/pending')
  @UseGuards(RolesGuard)
  @RequirePermission('task:assign')
  getPendingDelegations() {
    return this.tasks.getPendingDelegations();
  }

  @Post('delegations/:id/approve')
  @UseGuards(RolesGuard)
  @RequirePermission('task:assign')
  approveDelegation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') approverId: string,
  ) {
    return this.tasks.approveDelegation(id, approverId);
  }

  @Post('delegations/:id/reject')
  @UseGuards(RolesGuard)
  @RequirePermission('task:assign')
  rejectDelegation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') approverId: string,
    @Body('reason') reason?: string,
  ) {
    return this.tasks.rejectDelegation(id, approverId, reason);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.findOne(id);
  }

  @Get(':id/holds')
  getHolds(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.getHolds(id);
  }

  // ── CREATE ───────────────────────────────────────────────────────────────────
  @Post()
  @UseGuards(RolesGuard)
  @RequirePermission('task:assign')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTaskDto) {
    return this.tasks.create(userId, dto);
  }

  // ── ADMIN ASSIGN ─────────────────────────────────────────────────────────────
  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @RequirePermission('task:assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('user_id') toUserId: string,
  ) {
    return this.tasks.assign(id, toUserId);
  }

  // ── ADMIN CANCEL (soft) ──────────────────────────────────────────────────────
  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CancelTaskDto,
  ) {
    return this.tasks.cancel(id, userId, dto);
  }

  // ── ACCEPT / REJECT ──────────────────────────────────────────────────────────
  @Post(':id/accept')
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasks.accept(id, userId);
  }

  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RejectTaskDto,
  ) {
    return this.tasks.reject(id, userId, dto);
  }

  // ── HANDOVER (delegasi darurat — immediate, no approval) ─────────────────────
  @Post(':id/handover')
  handover(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: HandoverTaskDto,
  ) {
    return this.tasks.handover(id, userId, dto);
  }

  // ── DELEGATE ─────────────────────────────────────────────────────────────────
  @Post(':id/delegate')
  delegate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: DelegateTaskDto,
  ) {
    return this.tasks.delegate(id, userId, dto);
  }

  // ── SWAP REQUEST ─────────────────────────────────────────────────────────────
  @Post(':id/swap-request')
  swapRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SwapRequestDto,
  ) {
    return this.tasks.swapRequest(id, userId, dto);
  }

  // ── ON HOLD ──────────────────────────────────────────────────────────────────
  @Post(':id/hold')
  holdTask(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: HoldTaskDto,
  ) {
    return this.tasks.holdTask(id, userId, dto);
  }

  @Post(':id/holds/:holdId/approve')
  @UseGuards(RolesGuard)
  @RequirePermission('task:assign')
  approveHold(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Param('holdId', ParseUUIDPipe) holdId: string,
    @CurrentUser('id') managerId: string,
    @Body() dto: ApproveHoldDto,
  ) {
    return this.tasks.approveHold(taskId, holdId, managerId, dto);
  }

  @Post(':id/holds/:holdId/reject')
  @UseGuards(RolesGuard)
  @RequirePermission('task:assign')
  rejectHold(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Param('holdId', ParseUUIDPipe) holdId: string,
    @CurrentUser('id') managerId: string,
    @Body() dto: RejectHoldDto,
  ) {
    return this.tasks.rejectHold(taskId, holdId, managerId, dto);
  }
}
