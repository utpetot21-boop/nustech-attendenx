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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WarningLettersService } from './warning-letters.service';
import { CreateWarningLetterDto } from './dto/create-warning-letter.dto';

@ApiTags('warning-letters')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warning-letters')
export class WarningLettersController {
  constructor(private readonly service: WarningLettersService) {}

  // GET /warning-letters
  @Get()
  @RequirePermission('users:update')
  @ApiOperation({ summary: 'List semua SP (admin/HR)' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'level', required: false, enum: ['SP1', 'SP2', 'SP3'] })
  findAll(
    @Query('userId') userId?: string,
    @Query('level') level?: string,
  ) {
    return this.service.findAll(userId, level);
  }

  // GET /warning-letters/user/:userId
  @Get('user/:userId')
  @RequirePermission('users:update')
  @ApiOperation({ summary: 'Riwayat SP karyawan tertentu' })
  findByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.findByUser(userId);
  }

  // GET /warning-letters/me
  @Get('me')
  @ApiOperation({ summary: 'SP milik saya sendiri' })
  findMine(@CurrentUser('id') userId: string) {
    return this.service.findByUser(userId);
  }

  // GET /warning-letters/:id
  @Get(':id')
  @ApiOperation({ summary: 'Detail SP' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  // POST /warning-letters
  @Post()
  @RequirePermission('users:update')
  @ApiOperation({ summary: 'Buat SP baru (admin/HR)' })
  create(
    @Body() dto: CreateWarningLetterDto,
    @CurrentUser('id') issuedBy: string,
  ) {
    return this.service.create(dto, issuedBy);
  }

  // POST /warning-letters/:id/acknowledge
  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Karyawan acknowledge (konfirmasi terima SP)' })
  acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.acknowledge(id, userId);
  }

  // GET /warning-letters/:id/pdf
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Get PDF URL Surat Peringatan' })
  getPdf(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getPdfUrl(id);
  }
}
