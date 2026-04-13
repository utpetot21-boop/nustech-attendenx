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
import { ServiceReportsService } from './service-reports.service';
import { CreateServiceReportDto } from './dto/create-service-report.dto';
import { SignTechnicianDto } from './dto/sign-technician.dto';
import { SignClientDto } from './dto/sign-client.dto';

interface JwtPayload {
  sub: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('service-reports')
export class ServiceReportsController {
  constructor(private readonly svc: ServiceReportsService) {}

  // POST /service-reports  (technician creates draft BA from a completed visit)
  @Post()
  @RequirePermission('task:own', 'task:assign')
  create(
    @CurrentUser() user: JwtPayload,
    @Query('visit_id', ParseUUIDPipe) visitId: string,
    @Body() dto: CreateServiceReportDto,
  ) {
    return this.svc.create(user.sub, visitId, dto);
  }

  // POST /service-reports/:id/sign-technician  (multipart: file=signature image)
  @Post(':id/sign-technician')
  @RequirePermission('task:own')
  @UseInterceptors(FileInterceptor('signature', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async signTechnician(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SignTechnicianDto,
  ) {
    // Accept either file upload OR base64 body field
    const buf = file?.buffer ?? Buffer.from(dto.signature_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    return this.svc.signTechnician(user.sub, id, buf);
  }

  // POST /service-reports/:id/sign-client  (multipart optional: file=photo signature)
  @Post(':id/sign-client')
  @RequirePermission('task:own')
  @UseInterceptors(FileInterceptor('signature_file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  signClient(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SignClientDto,
  ) {
    return this.svc.signClient(user.sub, id, dto, file?.buffer);
  }

  // GET /service-reports/:id/pdf  — stream PDF ke browser
  @Get(':id/pdf')
  @RequirePermission('task:own', 'task:assign')
  async downloadPdf(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const buf = await this.svc.generatePdf(user.sub, id, user.role);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BA-${id}.pdf"`);
    res.send(buf);
  }

  // GET /service-reports/me  — list milik teknisi
  @Get('me')
  @RequirePermission('task:own', 'task:assign')
  findMine(
    @CurrentUser() user: JwtPayload,
    @Query('month') month?: string,
  ) {
    return this.svc.findMine(user.sub, month);
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

  // GET /service-reports/:id  — detail
  @Get(':id')
  @RequirePermission('task:own', 'task:assign')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }
}
