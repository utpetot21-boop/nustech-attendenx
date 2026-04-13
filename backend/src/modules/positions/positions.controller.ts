import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CreatePositionDto } from './dto/create-position.dto';
import { PositionsService } from './positions.service';

class UpdatePositionDto extends PartialType(CreatePositionDto) {}

@ApiTags('positions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @ApiOperation({ summary: 'List semua jabatan' })
  findAll() { return this.positionsService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Detail jabatan' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.positionsService.findOne(id);
  }

  @Post()
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Buat jabatan baru' })
  create(@Body() dto: CreatePositionDto) {
    return this.positionsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Update jabatan' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePositionDto) {
    return this.positionsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('settings:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hapus jabatan' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.positionsService.remove(id);
  }
}
