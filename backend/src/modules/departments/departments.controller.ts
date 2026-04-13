import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { DepartmentsService } from './departments.service';

class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

@ApiTags('departments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private deptService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List semua departemen' })
  findAll() { return this.deptService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Detail departemen' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.deptService.findOne(id); }

  @Post()
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Buat departemen baru' })
  create(@Body() dto: CreateDepartmentDto) { return this.deptService.create(dto); }

  @Patch(':id')
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Update departemen' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    return this.deptService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('settings:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hapus departemen' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.deptService.remove(id); }
}
