import {
  Body, Controller, Get, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';
import { UpdateAttendanceConfigDto } from './dto/update-attendance-config.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── Profil Perusahaan ───────────────────────────────────────────────────
  @Get('profile')
  @ApiOperation({ summary: 'Ambil profil perusahaan' })
  getProfile() {
    return this.settingsService.getProfile();
  }

  @Patch('profile')
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Update profil perusahaan' })
  updateProfile(@Body() dto: UpdateProfileDto) {
    return this.settingsService.updateProfile(dto);
  }

  // ── Aturan Absensi ──────────────────────────────────────────────────────
  @Get('attendance')
  @ApiOperation({ summary: 'Ambil konfigurasi aturan absensi' })
  getAttendanceConfig() {
    return this.settingsService.getAttendanceConfig();
  }

  @Patch('attendance')
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Update aturan absensi (admin only)' })
  updateAttendanceConfig(
    @Body() dto: UpdateAttendanceConfigDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.settingsService.updateAttendanceConfig(dto, adminId);
  }

  // ── WhatsApp ────────────────────────────────────────────────────────────
  @Get('whatsapp')
  @RequirePermission('attendance:manage')
  @ApiOperation({ summary: 'Status koneksi WhatsApp' })
  getWhatsappStatus() {
    return this.settingsService.getWhatsappStatus();
  }

  // ── Backup & Restore ────────────────────────────────────────────────────
  @Get('backups')
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Riwayat backup' })
  getBackupHistory() {
    return this.settingsService.getBackupHistory();
  }

  @Post('backups/trigger')
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Trigger backup manual' })
  triggerBackup(@CurrentUser('id') adminId: string) {
    return this.settingsService.triggerManualBackup(adminId);
  }
}
