import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';

import { ClientEntity } from './entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(ClientEntity)
    private repo: Repository<ClientEntity>,
    @InjectDataSource()
    private ds: DataSource,
  ) {}

  async findAll(search?: string, contractType?: string): Promise<ClientEntity[]> {
    const where: any = {};
    if (search) where.name = ILike(`%${search}%`);
    if (contractType) where.contract_type = contractType;
    return this.repo.find({ where, order: { name: 'ASC' }, relations: ['account_manager'] });
  }

  async findOne(id: string): Promise<ClientEntity> {
    const client = await this.repo.findOne({ where: { id }, relations: ['account_manager'] });
    if (!client) throw new NotFoundException('Klien tidak ditemukan');
    return client;
  }

  async getSlaPerformance(clientId: string, month: string) {
    const [visits] = await this.ds.query(`
      SELECT
        COUNT(*) AS visits_count,
        AVG(EXTRACT(EPOCH FROM (v.check_in_at - t.created_at)) / 3600) AS avg_response_hrs,
        AVG(v.duration_minutes / 60.0) AS avg_completion_hrs
      FROM visits v
      LEFT JOIN tasks t ON t.id = v.task_id
      WHERE v.client_id = $1
        AND to_char(v.check_in_at, 'YYYY-MM') = $2
        AND v.status = 'completed'
    `, [clientId, month]);

    return {
      month,
      visits_count: Number(visits?.visits_count ?? 0),
      avg_response_hrs: visits?.avg_response_hrs ? Number(Number(visits.avg_response_hrs).toFixed(1)) : null,
      avg_completion_hrs: visits?.avg_completion_hrs ? Number(Number(visits.avg_completion_hrs).toFixed(1)) : null,
    };
  }

  async getSlaHistory(clientId: string, limit = 12) {
    const rows = await this.ds.query(`
      SELECT
        to_char(v.check_in_at, 'YYYY-MM') AS month,
        COUNT(*) AS visits_count,
        AVG(EXTRACT(EPOCH FROM (v.check_in_at - t.created_at)) / 3600) AS avg_response_hrs,
        AVG(v.duration_minutes / 60.0) AS avg_completion_hrs
      FROM visits v
      LEFT JOIN tasks t ON t.id = v.task_id
      WHERE v.client_id = $1 AND v.status = 'completed'
      GROUP BY to_char(v.check_in_at, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT $2
    `, [clientId, limit]);
    return rows;
  }

  async getMonthVisitCount(clientId: string) {
    const month = new Date().toISOString().slice(0, 7);
    const [row] = await this.ds.query(
      `SELECT COUNT(*) AS cnt FROM visits WHERE client_id = $1 AND to_char(check_in_at, 'YYYY-MM') = $2`,
      [clientId, month],
    );
    return Number(row?.cnt ?? 0);
  }

  async create(dto: CreateClientDto): Promise<ClientEntity> {
    const existing = await this.repo.findOne({
      where: { name: ILike(dto.name) },
    });
    if (existing) throw new ConflictException('Nama klien sudah terdaftar');

    return this.repo.save(
      this.repo.create({
        ...dto,
        radius_meter: dto.radius_meter ?? 200,
        is_active: dto.is_active ?? true,
      }),
    );
  }

  async update(id: string, dto: Partial<CreateClientDto>): Promise<ClientEntity> {
    await this.findOne(id); // throws if not found
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.update(id, { is_active: false });
  }
}
