import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';

import { AnnouncementEntity } from '../entities/announcement.entity';

/**
 * Announcement Expiry Job — setiap hari 01:00 WITA
 * Nonaktifkan pengumuman yang sudah melewati expires_at
 */
@Injectable()
export class AnnouncementExpiryJob {
  private readonly logger = new Logger(AnnouncementExpiryJob.name);

  constructor(
    @InjectRepository(AnnouncementEntity)
    private annRepo: Repository<AnnouncementEntity>,
  ) {}

  @Cron('0 0 1 * * *', { timeZone: 'Asia/Makassar' }) // 01:00 WITA setiap hari
  async run(): Promise<void> {
    try {
      const now = new Date();

      const result = await this.annRepo
        .createQueryBuilder()
        .update(AnnouncementEntity)
        .set({ status: 'expired' })
        .where('status = :status', { status: 'sent' })
        .andWhere('expires_at IS NOT NULL')
        .andWhere('expires_at < :now', { now })
        .execute();

      if (result.affected && result.affected > 0) {
        this.logger.log(`Expired ${result.affected} pengumuman (run: ${now.toISOString()})`);
      }
    } catch (err) {
      this.logger.error(`AnnouncementExpiryJob error: ${(err as Error).message}`);
    }
  }
}
