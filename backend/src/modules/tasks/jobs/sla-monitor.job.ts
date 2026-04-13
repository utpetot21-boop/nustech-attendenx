import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { TaskEntity } from '../entities/task.entity';
import { ClientEntity } from '../../clients/entities/client.entity';
import { NotificationsService } from '../../notifications/notifications.service';

/**
 * SLA Monitor — setiap 15 menit
 * Cek tugas yang mendekati atau melewati batas SLA klien (sla_response_hours)
 * Kirim notif ke manager/admin jika SLA hampir terlewat (< 30 menit sisa)
 */
@Injectable()
export class SlaMonitorJob {
  private readonly logger = new Logger(SlaMonitorJob.name);

  constructor(
    @InjectRepository(TaskEntity)
    private taskRepo: Repository<TaskEntity>,
    @InjectRepository(ClientEntity)
    private clientRepo: Repository<ClientEntity>,
    private notifications: NotificationsService,
  ) {}

  @Cron('0 */15 * * * *', { timeZone: 'Asia/Makassar' })
  async run(): Promise<void> {
    try {
      // Ambil semua task yang masih aktif (belum selesai)
      const activeTasks = await this.taskRepo.find({
        where: {
          status: In(['pending_confirmation', 'assigned', 'in_progress']),
        },
        relations: ['client', 'assignee'],
      });

      if (activeTasks.length === 0) return;

      const now = new Date();
      let slaBreached = 0;
      let slaWarning = 0;

      for (const task of activeTasks) {
        if (!task.client_id || !task.client) continue;

        const slaHours = (task.client as ClientEntity).sla_response_hours ?? 24;
        const taskAgeMs = now.getTime() - new Date(task.created_at).getTime();
        const slaDeadlineMs = slaHours * 60 * 60 * 1000;
        const remainingMs = slaDeadlineMs - taskAgeMs;
        const remainingMinutes = Math.floor(remainingMs / 60_000);

        // SLA terlewat
        if (remainingMinutes < 0) {
          slaBreached++;
          const overdueMinutes = Math.abs(remainingMinutes);
          this.logger.warn(
            `SLA TERLEWAT — Task "${task.title}" (${task.id}) klien ${task.client.name}: ` +
            `${Math.floor(overdueMinutes / 60)}j ${overdueMinutes % 60}m terlambat`,
          );

          // Kirim notif hanya sekali per jam (cek apakah sudah ada notif 1 jam terakhir)
          if (overdueMinutes % 60 < 16) { // hanya saat menit ke-0-15 tiap jam
            await this.notifications.send({
              userId: task.assigned_to ?? '__admin__',
              title: `⚠️ SLA Terlewat — ${task.client.name}`,
              body: `Tugas "${task.title}" melewati SLA ${slaHours} jam. ` +
                    `Terlambat: ${Math.floor(overdueMinutes / 60)}j ${overdueMinutes % 60}m.`,
              type: 'sla_breach',
              data: { task_id: task.id, client_id: task.client_id },
            }).catch(() => {});
          }
        }
        // Peringatan: sisa < 30 menit
        else if (remainingMinutes < 30) {
          slaWarning++;
          this.logger.warn(
            `SLA HAMPIR TERLEWAT — Task "${task.title}" (${task.id}) klien ${task.client.name}: ` +
            `${remainingMinutes} menit tersisa`,
          );

          if (remainingMinutes >= 14 && remainingMinutes <= 16) {
            await this.notifications.send({
              userId: task.assigned_to ?? '__admin__',
              title: `⏰ SLA Hampir Habis — ${task.client.name}`,
              body: `Tugas "${task.title}" memiliki sisa ~${remainingMinutes} menit sebelum SLA terlewat.`,
              type: 'sla_warning',
              data: { task_id: task.id, remaining_minutes: String(remainingMinutes) },
            }).catch(() => {});
          }
        }
      }

      if (slaBreached > 0 || slaWarning > 0) {
        this.logger.log(`SLA check: ${slaBreached} terlewat, ${slaWarning} hampir terlewat dari ${activeTasks.length} tugas aktif`);
      }
    } catch (err) {
      this.logger.error(`SlaMonitorJob error: ${(err as Error).message}`);
    }
  }
}
