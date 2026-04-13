import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar klien' })
  findAll(@Query('search') search?: string, @Query('contract_type') contractType?: string) {
    return this.clientsService.findAll(search, contractType);
  }

  @Get(':id/sla')
  @ApiOperation({ summary: 'SLA performance klien bulan ini' })
  getSlaPerformance(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('month') month?: string,
  ) {
    return this.clientsService.getSlaPerformance(id, month ?? new Date().toISOString().slice(0, 7));
  }

  @Get(':id/sla/history')
  @ApiOperation({ summary: 'Riwayat SLA klien per bulan' })
  getSlaHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.getSlaHistory(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findOne(id);
  }

  @Post()
  @RequirePermission('task:assign')
  @ApiOperation({ summary: 'Tambah klien baru' })
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('task:assign')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateClientDto>,
  ) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Nonaktifkan klien (soft delete)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.remove(id);
  }
}
