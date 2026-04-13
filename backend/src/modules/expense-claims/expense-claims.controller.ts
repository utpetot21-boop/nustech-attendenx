import {
  Body, Controller, Get, Param, ParseUUIDPipe,
  Post, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExpenseClaimsService } from './expense-claims.service';
import { CreateClaimDto } from './dto/create-claim.dto';
import { ReviewClaimDto } from './dto/review-claim.dto';

interface JwtPayload { sub: string; role: string }

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expense-claims')
export class ExpenseClaimsController {
  constructor(private readonly svc: ExpenseClaimsService) {}

  // GET /expense-claims/config  — semua kategori + batas
  @Get('config')
  getConfig() { return this.svc.getConfig(); }

  // PATCH /expense-claims/config/:category (admin)
  @Post('config/:category')
  @RequirePermission('settings:manage')
  updateConfig(
    @Param('category') category: string,
    @Body('max_amount') maxAmount: number,
    @Body('receipt_required_above') receiptAbove: number,
  ) {
    return this.svc.updateConfig(category, maxAmount, receiptAbove);
  }

  // POST /expense-claims/upload-receipt  (multipart, returns URL)
  @Post('upload-receipt')
  @RequirePermission('task:own', 'task:assign')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadReceipt(@UploadedFile() file: Express.Multer.File) {
    const url = await this.svc.uploadReceipt(file.buffer, file.mimetype);
    return { url };
  }

  // POST /expense-claims
  @Post()
  @RequirePermission('task:own', 'task:assign')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateClaimDto) {
    return this.svc.create(user.sub, dto);
  }

  // GET /expense-claims/me
  @Get('me')
  findMine(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.svc.findMine(user.sub, status);
  }

  // GET /expense-claims  (admin/manager)
  @Get()
  @RequirePermission('task:assign')
  findAll(
    @Query('status') status?: string,
    @Query('user_id') userId?: string,
    @Query('month') month?: string,
  ) {
    return this.svc.findAll({ status, userId, month });
  }

  // GET /expense-claims/payroll?month=YYYY-MM  (admin/manager)
  @Get('payroll')
  @RequirePermission('task:assign')
  payroll(@Query('month') month: string) {
    return this.svc.getPayrollSummary(month ?? new Date().toISOString().slice(0, 7));
  }

  // GET /expense-claims/payroll/export?month=YYYY-MM  — download XLSX
  @Get('payroll/export')
  @RequirePermission('task:assign')
  async exportPayroll(
    @Query('month') month: string,
    @Res() res: Response,
  ) {
    const m = month ?? new Date().toISOString().slice(0, 7);
    const buffer = await this.svc.exportPayrollXlsx(m);
    res.setHeader('Content-Disposition', `attachment; filename="payroll-klaim-${m}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  }

  // POST /expense-claims/:id/review  (admin/manager)
  @Post(':id/review')
  @RequirePermission('task:assign')
  review(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewClaimDto,
  ) {
    return this.svc.review(id, user.sub, dto);
  }
}
