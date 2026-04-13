import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LeaveConfigService } from './leave-config.service';
import { UpdateLeaveConfigDto } from './dto/update-leave-config.dto';

@ApiTags('Leave Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave/config')
export class LeaveConfigController {
  constructor(private configService: LeaveConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Ambil konfigurasi cuti perusahaan' })
  getConfig() {
    return this.configService.getConfig();
  }

  @Patch()
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Update konfigurasi cuti (admin only)' })
  updateConfig(
    @Body() dto: UpdateLeaveConfigDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.configService.updateConfig(dto, adminId);
  }
}
