import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe,
  Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SosService } from './sos.service';
import { ActivateSosDto } from './dto/activate-sos.dto';
import { SosGateway } from './sos.gateway';
import { UserEntity } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sos')
export class SosController {
  constructor(
    private readonly svc: SosService,
    private readonly gateway: SosGateway,
  ) {}

  // POST /sos/activate  — karyawan aktifkan SOS
  @Post('activate')
  async activate(@CurrentUser() user: UserEntity, @Body() dto: ActivateSosDto) {
    const alert = await this.svc.activate(user.id, dto);
    this.gateway.broadcastSosActivated(alert.id, user.id, dto.lat, dto.lng);
    return alert;
  }

  // POST /sos/cancel  — karyawan batalkan SOS sendiri
  @Post('cancel')
  cancel(@CurrentUser() user: UserEntity) {
    return this.svc.cancel(user.id);
  }

  // GET /sos/me  — status SOS aktif milik user
  @Get('me')
  getMyActive(@CurrentUser() user: UserEntity) {
    return this.svc.getMyActive(user.id);
  }

  // GET /sos/active  — semua SOS aktif (admin/manager)
  @Get('active')
  @RequirePermission('attendance:manage')
  findActive() {
    return this.svc.findActive();
  }

  // GET /sos/history  — riwayat SOS (admin/manager)
  @Get('history')
  @RequirePermission('attendance:manage')
  findHistory(@Query('limit') limit?: string) {
    return this.svc.findHistory(limit ? parseInt(limit) : 100);
  }

  // GET /sos/:id/tracks
  @Get(':id/tracks')
  @RequirePermission('attendance:manage')
  getTracks(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getTracks(id);
  }

  // POST /sos/:id/respond  — manajer tandai direspons
  @Post(':id/respond')
  @RequirePermission('attendance:manage')
  async respond(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const alert = await this.svc.markResponded(id, user.id);
    this.gateway.notifyUserResponded(alert.user_id, id);
    return alert;
  }

  // POST /sos/:id/resolve  — manajer selesaikan SOS
  @Post(':id/resolve')
  @RequirePermission('attendance:manage')
  resolve(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes?: string,
  ) {
    return this.svc.resolve(id, user.id, notes);
  }

  // ── Kontak darurat ────────────────────────────────────────────────────────
  @Get('contacts')
  getContacts() { return this.svc.getContacts(); }

  @Post('contacts')
  @RequirePermission('attendance:manage')
  addContact(
    @Body('name') name: string,
    @Body('role') role: string,
    @Body('phone') phone: string,
    @Body('priority') priority: number,
  ) {
    return this.svc.addContact(name, role, phone, priority ?? 1);
  }

  @Delete('contacts/:id')
  @RequirePermission('settings:manage')
  removeContact(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeContact(id);
  }
}
