import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SaveFormResponsesDto } from './dto/save-form-responses.dto';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VisitsService } from './visits.service';
import { OsrmService } from '../../services/osrm.service';
import { CheckInVisitDto } from './dto/check-in-visit.dto';
import { AddPhotoDto } from './dto/add-photo.dto';
import { CheckOutVisitDto } from './dto/check-out-visit.dto';
import { ReviewVisitDto } from './dto/review-visit.dto';
import { GivePhotoFeedbackDto } from './dto/give-photo-feedback.dto';
import { AdminUpdateVisitDto } from './dto/admin-update-visit.dto';
import { UpdateVisitReportDto } from './dto/update-visit-report.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('visits')
export class VisitsController {
  constructor(
    private readonly visitsService: VisitsService,
    private readonly osrm: OsrmService,
  ) {}

  // GET /visits/route  — OSRM route between two coordinates
  @Get('route')
  getRoute(
    @Query('originLat') originLat: string,
    @Query('originLng') originLng: string,
    @Query('destLat') destLat: string,
    @Query('destLng') destLng: string,
  ) {
    return this.osrm.getRoute(+originLat, +originLng, +destLat, +destLng);
  }

  // POST /visits/check-in
  @Post('check-in')
  checkIn(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckInVisitDto,
  ) {
    return this.visitsService.checkIn(userId, dto);
  }

  // POST /visits/:id/photos
  @Post(':id/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new Error('Hanya file gambar yang diizinkan.'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  addPhoto(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) visitId: string,
    @Body() dto: AddPhotoDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('File foto wajib diunggah.');
    }
    return this.visitsService.addPhoto(userId, visitId, dto, file.buffer);
  }

  // POST /visits/:id/check-out
  @Post(':id/check-out')
  checkOut(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) visitId: string,
    @Body() dto: CheckOutVisitDto,
  ) {
    return this.visitsService.checkOut(userId, visitId, dto);
  }

  // GET /visits  (admin/manager — semua kunjungan)
  @Get()
  @RequirePermission('task:assign')
  findAll(
    @Query('status') status?: string,
    @Query('user_id') userId?: string,
    @Query('client_id') clientId?: string,
    @Query('date') date?: string,
    @Query('review_status') reviewStatus?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.visitsService.findAll({ status, userId, clientId, date, reviewStatus, page: page ? +page : 1, limit: limit ? +limit : 50 });
  }

  // GET /visits/admin/:id  (admin/manager — detail tanpa batasan user_id)
  @Get('admin/:id')
  @RequirePermission('task:assign')
  getAdminDetail(@Param('id', ParseUUIDPipe) visitId: string) {
    return this.visitsService.getAdminDetail(visitId);
  }

  // GET /visits/me
  @Get('me')
  getMyVisits(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.visitsService.getMyVisits(userId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      status,
    });
  }

  // GET /visits/:id
  @Get(':id')
  getDetail(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) visitId: string,
  ) {
    return this.visitsService.getVisitDetail(userId, visitId);
  }

  // GET /visits/:id/photo-counts
  @Get(':id/photo-counts')
  getPhotoCounts(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) visitId: string,
  ) {
    return this.visitsService.getPhotoCounts(visitId, userId);
  }

  // POST /visits/:id/form-responses — simpan jawaban formulir kunjungan
  @Post(':id/form-responses')
  saveFormResponses(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) visitId: string,
    @Body() dto: SaveFormResponsesDto,
  ) {
    return this.visitsService.saveFormResponses(visitId, userId, dto.responses);
  }

  // GET /visits/:id/form-responses — ambil jawaban formulir kunjungan
  @Get(':id/form-responses')
  getFormResponses(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) visitId: string,
  ) {
    return this.visitsService.getFormResponses(visitId, userId);
  }

  // POST /visits/:id/photos/admin — upload foto dokumentasi tambahan oleh admin
  @Post(':id/photos/admin')
  @RequirePermission('task:assign')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new Error('Hanya file gambar yang diizinkan.'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  addAdminPhoto(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) visitId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('File foto wajib diunggah.');
    return this.visitsService.addAdminPhoto(adminId, visitId, file.buffer);
  }

  // POST /visits/:id/review — evaluasi kunjungan selesai (admin/manager)
  @Post(':id/review')
  @RequirePermission('task:assign')
  reviewVisit(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) visitId: string,
    @Body() dto: ReviewVisitDto,
  ) {
    return this.visitsService.reviewVisit(adminId, visitId, dto);
  }

  // GET /visits/sla-breaches — daftar pelanggaran SLA (admin)
  @Get('sla-breaches')
  @RequirePermission('task:assign')
  getSlaBreaches(
    @Query('client_id') clientId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.visitsService.getSlaBreaches({
      clientId,
      page: page ? +page : 1,
      limit: limit ? +limit : 50,
    });
  }

  // PATCH /visits/:visitId/photos/:photoId/feedback — admin beri catatan pada foto
  @Patch(':visitId/photos/:photoId/feedback')
  @RequirePermission('task:assign')
  givePhotoFeedback(
    @CurrentUser('id') adminId: string,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Body() dto: GivePhotoFeedbackDto,
  ) {
    return this.visitsService.givePhotoFeedback(visitId, photoId, adminId, dto);
  }

  // DELETE /visits/:visitId/photos/:photoId/feedback — admin hapus catatan foto
  @Delete(':visitId/photos/:photoId/feedback')
  @RequirePermission('task:assign')
  clearPhotoFeedback(
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.visitsService.clearPhotoFeedback(visitId, photoId);
  }

  // PATCH /visits/:id — admin edit data laporan kunjungan
  @Patch(':id')
  @RequirePermission('task:assign')
  adminUpdateVisit(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) visitId: string,
    @Body() dto: AdminUpdateVisitDto,
  ) {
    return this.visitsService.adminUpdateVisit(visitId, adminId, dto);
  }

  // GET /visits/:id/audit-log — riwayat perubahan kunjungan
  @Get(':id/audit-log')
  @RequirePermission('task:assign')
  getAuditLog(@Param('id', ParseUUIDPipe) visitId: string) {
    return this.visitsService.getVisitAuditLog(visitId);
  }

  // ── Revision Flow (Opsi C) ──────────────────────────────────────────────────

  // PATCH /visits/:id/report — teknisi edit teks laporan saat revision_needed
  @Patch(':id/report')
  updateReport(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) visitId: string,
    @Body() dto: UpdateVisitReportDto,
  ) {
    return this.visitsService.updateReport(userId, visitId, dto);
  }

  // PUT /visits/:visitId/photos/:photoId — teknisi ganti foto needs_retake
  @Put(':visitId/photos/:photoId')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new Error('Hanya file gambar yang diizinkan.'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  replacePhoto(
    @CurrentUser('id') userId: string,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('File foto wajib diunggah.');
    return this.visitsService.replacePhoto(userId, visitId, photoId, file.buffer);
  }

  // POST /visits/:id/submit-revision — teknisi submit revisi selesai
  @Post(':id/submit-revision')
  submitRevision(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) visitId: string,
  ) {
    return this.visitsService.submitRevision(userId, visitId);
  }
}
