import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ServiceReportsService } from './service-reports.service';
import { CreateServiceReportDto } from './dto/create-service-report.dto';
import { SignTechnicianDto } from './dto/sign-technician.dto';
import { SignClientDto } from './dto/sign-client.dto';
import { UserEntity } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('service-reports')
export class ServiceReportsController {
  constructor(private readonly svc: ServiceReportsService) {}

  // POST /service-reports  (technician creates draft BA from a completed visit)
  @Post()
  @RequirePermission('task:own', 'task:assign')
  create(
    @CurrentUser() user: UserEntity,
    @Query('visit_id', ParseUUIDPipe) visitId: string,
    @Body() dto: CreateServiceReportDto,
  ) {
    return this.svc.create(user.id, visitId, dto);
  }

  // POST /service-reports/:id/sign-technician  (multipart: file=signature image)
  @Post(':id/sign-technician')
  @RequirePermission('task:own')
  @UseInterceptors(FileInterceptor('signature', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async signTechnician(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SignTechnicianDto,
  ) {
    // Accept either file upload OR base64 body field
    const buf = file?.buffer ?? Buffer.from(dto.signature_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    return this.svc.signTechnician(user.id, id, buf);
  }

  // POST /service-reports/:id/sign-client  (multipart optional: file=photo signature)
  @Post(':id/sign-client')
  @RequirePermission('task:own')
  @UseInterceptors(FileInterceptor('signature_file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  signClient(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SignClientDto,
  ) {
    return this.svc.signClient(user.id, id, dto, file?.buffer);
  }

  // GET /service-reports/:id/pdf  — stream PDF ke browser (Bearer auth)
  @Get(':id/pdf')
  @RequirePermission('task:own', 'task:assign')
  async downloadPdf(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const buf = await this.svc.generatePdf(user.id, id, user.role?.name ?? '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="BA-${id}.pdf"`);
    res.send(buf);
  }

  // GET /service-reports/:id/pdf-token  — ambil token 10 menit untuk buka PDF di browser
  @Get(':id/pdf-token')
  @RequirePermission('task:own', 'task:assign')
  async getPdfToken(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const token = await this.svc.generatePdfToken(user.id, id);
    return { token };
  }

  // GET /service-reports/:id/pdf-view?token=xxx  — buka PDF via token (public, untuk browser)
  @Public()
  @Get(':id/pdf-view')
  async viewPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const buf = await this.svc.generatePdfWithToken(token, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="BA-${id}.pdf"`);
    res.send(buf);
  }

  // GET /service-reports/me  — list milik teknisi
  @Get('me')
  @RequirePermission('task:own', 'task:assign')
  findMine(
    @CurrentUser() user: UserEntity,
    @Query('month') month?: string,
  ) {
    return this.svc.findMine(user.id, month);
  }

  // GET /service-reports  — admin/manager list
  @Get()
  @RequirePermission('report:view')
  findAll(
    @Query('month') month?: string,
    @Query('user_id') userId?: string,
    @Query('client_id') clientId?: string,
  ) {
    return this.svc.findAll({ month, userId, clientId });
  }

  // POST /service-reports/:id/send  — kirim BA ke email PIC klien
  @Post(':id/send')
  @RequirePermission('task:assign')
  sendToClient(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.sendToClient(id, user.id);
  }

  // GET /service-reports/:id  — detail
  @Get(':id')
  @RequirePermission('task:own', 'task:assign')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }
}
