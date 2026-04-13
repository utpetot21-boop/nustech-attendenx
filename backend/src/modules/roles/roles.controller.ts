import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus,
  NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RoleEntity } from './entities/role.entity';
import { UserEntity } from '../users/entities/user.entity';

class CreateRoleDto {
  @IsString() @MinLength(2) @MaxLength(50) name!: string;
  @IsOptional() @IsBoolean() can_delegate?: boolean;
  @IsOptional() @IsBoolean() can_approve?: boolean;
  @IsOptional() permissions?: string[];
}


@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roles')
export class RolesController {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List semua role' })
  findAll(): Promise<RoleEntity[]> {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail role' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException(`Role ${id} tidak ditemukan`);
    return role;
  }

  @Post()
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Buat role baru' })
  async create(@Body() dto: CreateRoleDto) {
    // Cegah nama yang sama dengan system role (case-insensitive)
    const conflict = await this.roleRepo
      .createQueryBuilder('r')
      .where('LOWER(r.name) = LOWER(:name)', { name: dto.name })
      .getOne();
    if (conflict) {
      throw new BadRequestException(`Role dengan nama "${dto.name}" sudah ada`);
    }
    return this.roleRepo.save(this.roleRepo.create({ ...dto, is_system: false } as any));
  }

  @Patch(':id')
  @RequirePermission('settings:manage')
  @ApiOperation({ summary: 'Update role' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateRoleDto>) {
    const role = await this.findOne(id);

    if (role.is_system) {
      // System role: hanya boleh update permissions, can_delegate, can_approve
      // Nama tidak boleh diubah
      const { name, ...safeDto } = dto;
      if (name && name !== role.name) {
        throw new BadRequestException(`Nama role sistem "${role.name}" tidak dapat diubah`);
      }
      Object.assign(role, safeDto);
    } else {
      // Custom role: boleh update semua, tapi cek konflik nama
      if (dto.name && dto.name !== role.name) {
        const conflict = await this.roleRepo
          .createQueryBuilder('r')
          .where('LOWER(r.name) = LOWER(:name)', { name: dto.name })
          .andWhere('r.id != :id', { id })
          .getOne();
        if (conflict) {
          throw new BadRequestException(`Role dengan nama "${dto.name}" sudah ada`);
        }
      }
      Object.assign(role, dto);
    }

    return this.roleRepo.save(role);
  }

  @Delete(':id')
  @RequirePermission('settings:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hapus role' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const role = await this.findOne(id);

    if (role.is_system) {
      throw new BadRequestException(`Role sistem "${role.name}" tidak dapat dihapus`);
    }

    const userCount = await this.userRepo.count({ where: { role_id: id } });
    if (userCount > 0) {
      throw new BadRequestException(
        `Tidak dapat menghapus role yang masih digunakan oleh ${userCount} karyawan`,
      );
    }

    await this.roleRepo.remove(role);
  }
}
