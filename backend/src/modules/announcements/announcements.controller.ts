import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe,
  Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@ApiTags('Announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  @Get()
  @RequirePermission('task:assign')
  @ApiOperation({ summary: 'Daftar semua pengumuman (admin)' })
  findAll(@Query('status') status?: string) {
    return this.svc.findAll(status);
  }

  @Get('me')
  @ApiOperation({ summary: 'Pengumuman untuk user ini' })
  getMyAnnouncements(@CurrentUser('id') userId: string) {
    return this.svc.getMyAnnouncements(userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/reads')
  @RequirePermission('task:assign')
  getReadStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getReadStats(id);
  }

  @Post()
  @RequirePermission('task:assign')
  @ApiOperation({ summary: 'Buat pengumuman baru' })
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser('id') userId: string) {
    return this.svc.create(dto, userId);
  }

  @Post(':id/send')
  @RequirePermission('task:assign')
  @ApiOperation({ summary: 'Kirim/publish pengumuman' })
  send(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.send(id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Tandai pengumuman sudah dibaca' })
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.svc.markRead(id, userId);
  }

  @Delete(':id')
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Hapus pengumuman' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.delete(id);
  }
}
