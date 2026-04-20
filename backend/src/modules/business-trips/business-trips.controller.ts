import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BusinessTripsService } from './business-trips.service';
import { CreateBusinessTripDto } from './dto/create-business-trip.dto';
import { UpdateBusinessTripDto } from './dto/update-business-trip.dto';
import { RejectTripDto } from './dto/review-trip.dto';

@ApiTags('business-trips')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('business-trips')
export class BusinessTripsController {
  constructor(private readonly service: BusinessTripsService) {}

  // ── LIST ──────────────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'List surat tugas (admin/manager: semua; karyawan: milik sendiri)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: { name?: string } | string | null,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const roleName = typeof role === 'string' ? role : role?.name ?? '';
    const isAdmin = ['admin', 'super_admin', 'manager'].includes(roleName);
    return this.service.findAll({
      userId: isAdmin ? undefined : userId,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  // ── DETAIL ────────────────────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Detail surat tugas' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  // ── CREATE ────────────────────────────────────────────────────────────────────
  @Post()
  @ApiOperation({ summary: 'Buat surat tugas baru (draft)' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBusinessTripDto,
  ) {
    return this.service.create(userId, dto);
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────────
  @Patch(':id')
  @ApiOperation({ summary: 'Update surat tugas (hanya draft/rejected)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: { name?: string } | string | null,
    @Body() dto: UpdateBusinessTripDto,
  ) {
    const roleName = typeof role === 'string' ? role : role?.name ?? '';
    return this.service.update(id, userId, roleName, dto);
  }

  // ── SUBMIT ────────────────────────────────────────────────────────────────────
  @Post(':id/submit')
  @ApiOperation({ summary: 'Ajukan surat tugas untuk persetujuan' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.submit(id, userId);
  }

  // ── APPROVE ───────────────────────────────────────────────────────────────────
  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @RequirePermission('task:assign')
  @ApiOperation({ summary: 'Setujui surat tugas (admin/manager)' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') approverId: string,
  ) {
    return this.service.approve(id, approverId);
  }

  // ── REJECT ────────────────────────────────────────────────────────────────────
  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @RequirePermission('task:assign')
  @ApiOperation({ summary: 'Tolak surat tugas (admin/manager)' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') approverId: string,
    @Body() dto: RejectTripDto,
  ) {
    return this.service.reject(id, approverId, dto.reason);
  }

  // ── DEPART ────────────────────────────────────────────────────────────────────
  @Post(':id/depart')
  @ApiOperation({ summary: 'Mulai perjalanan (approved → ongoing)' })
  depart(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.depart(id, userId);
  }

  // ── COMPLETE ──────────────────────────────────────────────────────────────────
  @Post(':id/complete')
  @ApiOperation({ summary: 'Selesaikan perjalanan (ongoing → completed)' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: { name?: string } | string | null,
    @Body() dto: { actual_cost?: number; doc_url?: string },
  ) {
    const roleName = typeof role === 'string' ? role : role?.name ?? '';
    return this.service.complete(id, userId, roleName, dto);
  }

  // ── CANCEL ────────────────────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Batalkan surat tugas' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: { name?: string } | string | null,
  ) {
    const roleName = typeof role === 'string' ? role : role?.name ?? '';
    return this.service.cancel(id, userId, roleName);
  }
}
