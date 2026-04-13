import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateLocationDto } from './dto/create-location.dto';
import { LocationsService } from './locations.service';

class UpdateLocationDto extends PartialType(CreateLocationDto) {}

@ApiTags('locations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('locations')
export class LocationsController {
  constructor(private locationService: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'List semua lokasi kantor aktif' })
  findAll() { return this.locationService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Detail lokasi' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.locationService.findOne(id); }

  @Post()
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Tambah lokasi baru' })
  create(@Body() dto: CreateLocationDto) { return this.locationService.create(dto); }

  @Patch(':id')
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Update lokasi' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocationDto) {
    return this.locationService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('settings:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Nonaktifkan lokasi' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.locationService.remove(id); }
}
