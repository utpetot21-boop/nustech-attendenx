import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './whatsapp.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly wa: WhatsAppService,
  ) {}

  @Get()
  getMyNotifs(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
  ) {
    return this.notifications.getForUser(userId, page ? parseInt(page) : 1);
  }

  @Get('unread-count')
  getUnread(@CurrentUser('id') userId: string) {
    return this.notifications.getUnreadCount(userId).then((count) => ({ count }));
  }

  @Post(':id/read')
  markRead(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(userId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Delete(':id')
  @HttpCode(204)
  hideNotif(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.hideForUser(userId, id);
  }

  // ── Admin WA management ─────────────────────────────────────────────────────
  @Get('/admin/wa/status')
  @UseGuards(RolesGuard)
  @RequirePermission('settings:manage')
  waStatus() {
    return this.wa.getStatus();
  }

  @Get('/admin/wa/qr')
  @UseGuards(RolesGuard)
  @RequirePermission('settings:manage')
  waQr() {
    return { qr: this.wa.getQrCode() };
  }
}
