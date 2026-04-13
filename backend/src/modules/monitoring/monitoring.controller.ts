import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UserEntity } from '../users/entities/user.entity';
import { VisitEntity } from '../visits/entities/visit.entity';

@ApiTags('monitoring')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission('attendance:manage')
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly realtime: RealtimeGateway,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(VisitEntity)
    private readonly visitRepo: Repository<VisitEntity>,
  ) {}

  /**
   * GET /monitoring/technicians
   * Kembalikan daftar teknisi aktif dengan posisi terakhir dari Redis
   * + info kunjungan aktif jika ada
   */
  @Get('technicians')
  @ApiOperation({ summary: 'Posisi terakhir semua teknisi aktif (Redis + DB)' })
  async getTechnicians() {
    // Ambil semua lokasi dari Redis
    const locations = await this.realtime.getAllLocations();
    const locationMap = new Map(locations.map((l) => [l.user_id, l]));

    // Ambil semua kunjungan aktif
    const ongoingVisits = await this.visitRepo.find({
      where: { status: 'ongoing' },
      relations: ['user', 'client', 'task'],
    });
    const visitByUser = new Map(ongoingVisits.map((v) => [v.user_id, v]));

    // Gabungkan data
    const result = locations.map((loc) => {
      const visit = visitByUser.get(loc.user_id);
      return {
        user_id: loc.user_id,
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
        heading: loc.heading,
        speed: loc.speed,
        timestamp: loc.timestamp,
        task_id: loc.task_id,
        status: visit ? 'visit' : 'active',
        visit: visit
          ? {
              id: visit.id,
              client_name: (visit as any).client?.name ?? null,
              check_in_at: (visit as any).check_in_at,
            }
          : null,
        user: visit?.user
          ? {
              id: visit.user.id,
              name: visit.user.full_name,
              employee_id: visit.user.employee_id,
            }
          : null,
      };
    });

    return { items: result, total: result.length };
  }
}
