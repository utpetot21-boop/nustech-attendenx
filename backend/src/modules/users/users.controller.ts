import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StorageService } from '../../services/storage.service';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateSelfDto } from './dto/update-self.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private authService: AuthService,
    private storageService: StorageService,
  ) {}

  // ── Self-service — tidak perlu permission khusus ──────────────────────────

  // GET /users/me — profil lengkap user yang sedang login
  @Get('me')
  @ApiOperation({ summary: 'Ambil profil lengkap user yang sedang login' })
  getMe(@CurrentUser() user: UserEntity) {
    return this.usersService.findOne(user.id);
  }

  // PATCH /users/me — update nama & telepon sendiri
  @Patch('me')
  @ApiOperation({ summary: 'Update nama/telepon user yang sedang login' })
  updateMe(@CurrentUser() user: UserEntity, @Body() dto: UpdateSelfDto) {
    return this.usersService.update(user.id, dto);
  }

  // POST /users/me/avatar — upload foto profil sendiri
  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload/ganti foto profil user yang sedang login' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMyAvatar(
    @CurrentUser() user: UserEntity,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ avatar_url: string }> {
    if (!file) throw new BadRequestException('File tidak ditemukan dalam request');
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Format tidak didukung. Gunakan JPG, PNG, atau WEBP');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Ukuran file maksimal 2 MB');
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const avatarUrl = await this.storageService.upload('avatars', ext, file.buffer, file.mimetype);
    await this.usersService.updateAvatar(user.id, avatarUrl);
    return { avatar_url: avatarUrl };
  }

  // ── Self-service: cari rekan (untuk picker tukar jadwal dll) ─────────────

  @Get('colleagues')
  @ApiOperation({ summary: 'Cari rekan karyawan aktif (semua user terlogin bisa akses)' })
  @ApiQuery({ name: 'search', required: false })
  async colleagues(
    @CurrentUser() me: UserEntity,
    @Query('search') search?: string,
  ) {
    const [items] = await this.usersService.findAll({
      search,
      limit: 20,
    });
    // Sembunyikan user yang sedang login dari hasil
    const filtered = items.filter((u) => u.id !== me.id);
    return { items: filtered };
  }

  // ── Admin endpoints ───────────────────────────────────────────────────────

  @Get('next-employee-id')
  @RequirePermission('users:create')
  @ApiOperation({ summary: 'Ambil employee_id berikutnya yang tersedia (NT-XXX)' })
  async nextEmployeeId() {
    return { employee_id: await this.usersService.generateNextEmployeeId() };
  }

  @Get()
  @RequirePermission('users:read')
  @ApiOperation({ summary: 'List semua karyawan' })
  @ApiQuery({ name: 'dept', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('dept') dept?: string,
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const [items, total] = await this.usersService.findAll({ dept, role, search, page: +page, limit: +limit });
    return { items, total, page: +page, limit: +limit };
  }

  @Get(':id')
  @RequirePermission('users:read')
  @ApiOperation({ summary: 'Detail karyawan by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermission('users:create')
  @ApiOperation({ summary: 'Buat karyawan baru (admin only)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('users:update')
  @ApiOperation({ summary: 'Update data karyawan' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('users:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Nonaktifkan karyawan (soft delete)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  // POST /users/:id/avatar — upload/ganti foto karyawan
  @Post(':id/avatar')
  @RequirePermission('users:update')
  @ApiOperation({ summary: 'Upload/ganti avatar karyawan (multipart/form-data, field: file)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ avatar_url: string }> {
    if (!file) throw new BadRequestException('File tidak ditemukan dalam request');
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Format file tidak didukung. Gunakan JPG, PNG, atau WEBP');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Ukuran file maksimal 2 MB');
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const avatarUrl = await this.storageService.upload('avatars', ext, file.buffer, file.mimetype);
    await this.usersService.updateAvatar(id, avatarUrl);
    return { avatar_url: avatarUrl };
  }

  // POST /users/:id/reset-pin — admin reset PIN absensi karyawan
  @Post(':id/reset-pin')
  @RequirePermission('users:read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin reset PIN absensi karyawan (karyawan harus set PIN baru)' })
  async resetPin(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.authService.adminResetPin(id);
  }

  // POST /users/:id/reset-password — admin reset password ke ID Karyawan
  @Post(':id/reset-password')
  @RequirePermission('users:read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset password karyawan ke ID Karyawan (must_change_password=true)' })
  async resetPassword(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.usersService.resetPassword(id);
  }
}
