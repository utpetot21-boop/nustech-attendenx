import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { ShiftTypesService } from './shift-types.service';
import { OfficeHoursService } from './office-hours.service';
import { UserSchedulesService } from './user-schedules.service';
import { NationalHolidaysService } from './national-holidays.service';

import { CreateShiftTypeDto } from './dto/create-shift-type.dto';
import { CreateOfficeHoursDto } from './dto/create-office-hours.dto';
import { AssignShiftDto } from './dto/assign-shift.dto';
import { CreateNationalHolidayDto } from './dto/create-national-holiday.dto';

@ApiTags('Schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedules')
export class ScheduleController {
  constructor(
    private shiftTypesService: ShiftTypesService,
    private officeHoursService: OfficeHoursService,
    private userSchedulesService: UserSchedulesService,
    private nationalHolidaysService: NationalHolidaysService,
  ) {}

  // ── Shift Types ────────────────────────────────────────────────

  @Get('shift-types')
  @ApiOperation({ summary: 'Daftar semua shift type' })
  getShiftTypes() {
    return this.shiftTypesService.findAll();
  }

  @Post('shift-types')
  @RequirePermission('schedule:manage')
  @ApiOperation({ summary: 'Buat shift type baru (8 jam)' })
  createShiftType(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateShiftTypeDto,
  ) {
    return this.shiftTypesService.create(dto, userId);
  }

  @Patch('shift-types/:id')
  @RequirePermission('schedule:manage')
  updateShiftType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateShiftTypeDto>,
  ) {
    return this.shiftTypesService.update(id, dto);
  }

  @Delete('shift-types/:id')
  @RequirePermission('schedule:manage')
  removeShiftType(@Param('id', ParseUUIDPipe) id: string) {
    return this.shiftTypesService.remove(id);
  }

  // ── Office Hours Config ────────────────────────────────────────

  @Get('office-hours/global')
  @ApiOperation({ summary: 'Ambil konfigurasi office hours global' })
  getGlobalOfficeHours() {
    return this.officeHoursService.findGlobal();
  }

  @Patch('office-hours/global')
  @RequirePermission('schedule:manage')
  @ApiOperation({ summary: 'Simpan/update konfigurasi office hours global' })
  upsertGlobalOfficeHours(
    @CurrentUser('id') userId: string,
    @Body() dto: Partial<CreateOfficeHoursDto>,
  ) {
    return this.officeHoursService.upsertGlobal(dto, userId);
  }

  @Get('office-hours/:userId')
  @ApiOperation({ summary: 'Konfigurasi office hours user' })
  getOfficeHours(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.officeHoursService.findByUser(userId);
  }

  @Post('office-hours')
  @RequirePermission('schedule:manage')
  @ApiOperation({ summary: 'Set office hours karyawan' })
  createOfficeHours(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOfficeHoursDto,
  ) {
    return this.officeHoursService.create(dto, userId);
  }

  // ── User Schedules ─────────────────────────────────────────────

  @Get('user/:userId')
  @ApiOperation({ summary: 'Jadwal user (date / week / month)' })
  @ApiQuery({ name: 'date', required: false, example: '2025-06-15' })
  @ApiQuery({ name: 'week', required: false, example: '2025-W24' })
  @ApiQuery({ name: 'month', required: false, example: '2025-06' })
  getUserSchedule(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('date') date?: string,
    @Query('week') week?: string,
    @Query('month') month?: string,
  ) {
    return this.userSchedulesService.findForUser(userId, { date, week, month });
  }

  @Get('me')
  @ApiOperation({ summary: 'Jadwal saya sendiri' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'week', required: false })
  @ApiQuery({ name: 'month', required: false })
  getMySchedule(
    @CurrentUser('id') userId: string,
    @Query('date') date?: string,
    @Query('week') week?: string,
    @Query('month') month?: string,
  ) {
    return this.userSchedulesService.findForUser(userId, { date, week, month });
  }

  @Get('team')
  @RequirePermission('schedule:manage')
  @ApiOperation({ summary: 'Jadwal team (filter dept & week)' })
  @ApiQuery({ name: 'dept', required: false })
  @ApiQuery({ name: 'week', required: false })
  getTeamSchedule(@Query('dept') dept?: string, @Query('week') week?: string) {
    return this.userSchedulesService.findTeamSchedule({ dept, week });
  }

  @Post('generate')
  @RequirePermission('schedule:manage')
  @ApiOperation({ summary: 'Generate jadwal manual untuk tanggal tertentu' })
  generateSchedule(@Body('date') date: string) {
    return this.userSchedulesService.generateForDate(date);
  }

  @Post('assign')
  @RequirePermission('schedule:manage')
  @ApiOperation({ summary: 'Assign shift ke karyawan' })
  assignShift(
    @CurrentUser('id') changedBy: string,
    @Body() dto: AssignShiftDto,
  ) {
    return this.userSchedulesService.assignShift({ ...dto, changed_by: changedBy });
  }

  @Delete('assign')
  @RequirePermission('schedule:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hapus assignment shift karyawan untuk tanggal tertentu' })
  unassignShift(
    @Body('user_id') userId: string,
    @Body('date') date: string,
  ) {
    return this.userSchedulesService.unassignShift(userId, date);
  }

  @Patch('override')
  @RequirePermission('schedule:manage')
  @ApiOperation({ summary: 'Override manual jadwal harian (tandai libur / masuk kerja)' })
  overrideDay(
    @CurrentUser('id') changedBy: string,
    @Body() body: { user_id: string; date: string; is_day_off: boolean },
  ) {
    return this.userSchedulesService.overrideDay({ ...body, changed_by: changedBy });
  }

  @Get('change-logs/:userId')
  @RequirePermission('schedule:manage')
  @ApiOperation({ summary: 'Riwayat perubahan jadwal karyawan' })
  getChangeLogs(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('month') month?: string,
  ) {
    return this.userSchedulesService.getChangeLogs(userId, { month });
  }

  // ── National Holidays ──────────────────────────────────────────

  @Get('holidays')
  @ApiOperation({ summary: 'Daftar hari libur nasional per tahun' })
  @ApiQuery({ name: 'year', required: false, example: 2025 })
  getHolidays(@Query('year', new ParseIntPipe({ optional: true })) year?: number) {
    return this.nationalHolidaysService.findByYear(year ?? new Date().getFullYear());
  }

  @Post('holidays')
  @RequirePermission('schedule:manage')
  @ApiOperation({ summary: 'Tambah hari libur nasional' })
  createHoliday(@Body() dto: CreateNationalHolidayDto) {
    return this.nationalHolidaysService.create(dto);
  }

  @Patch('holidays/:id')
  @RequirePermission('schedule:manage')
  updateHoliday(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateNationalHolidayDto>,
  ) {
    return this.nationalHolidaysService.update(id, dto);
  }

  @Delete('holidays/:id')
  @RequirePermission('schedule:manage')
  removeHoliday(@Param('id', ParseUUIDPipe) id: string) {
    return this.nationalHolidaysService.remove(id);
  }
}
