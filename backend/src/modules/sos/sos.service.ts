import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SosAlertEntity } from './entities/sos-alert.entity';
import { SosLocationTrackEntity } from './entities/sos-location-track.entity';
import { EmergencyContactEntity } from './entities/emergency-contact.entity';
import { ActivateSosDto } from './dto/activate-sos.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SosService {
  constructor(
    @InjectRepository(SosAlertEntity)
    private readonly alertRepo: Repository<SosAlertEntity>,
    @InjectRepository(SosLocationTrackEntity)
    private readonly trackRepo: Repository<SosLocationTrackEntity>,
    @InjectRepository(EmergencyContactEntity)
    private readonly contactRepo: Repository<EmergencyContactEntity>,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Aktifkan SOS ──────────────────────────────────────────────────────────
  async activate(userId: string, dto: ActivateSosDto): Promise<SosAlertEntity> {
    // Cek apakah sudah ada SOS aktif
    const existing = await this.alertRepo.findOne({
      where: { user_id: userId, status: 'active' },
    });
    if (existing) return existing; // idempotent — kembalikan yang sudah ada

    const alert = this.alertRepo.create({
      user_id: userId,
      last_lat: dto.lat,
      last_lng: dto.lng,
      battery_pct: dto.battery_pct ?? null,
    });
    const saved = await this.alertRepo.save(alert);

    // Simpan track pertama
    await this.trackRepo.save({
      alert_id: saved.id,
      lat: dto.lat,
      lng: dto.lng,
      battery_pct: dto.battery_pct ?? null,
    });

    // Ambil nama user yang aktivasi SOS (untuk pesan notif)
    const triggerUser = await this.alertRepo.manager.query(
      `SELECT full_name FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const senderName: string = triggerUser?.[0]?.full_name ?? 'Rekan Anda';

    // Notifikasi ke admin/manager — detail lengkap
    const adminIds = await this.getAdminManagerIds();
    this.notifications.sendMany(
      adminIds,
      'sos_alert',
      'SOS Aktif',
      `${senderName} membutuhkan bantuan darurat. Cek panel SOS segera.`,
    ).catch(() => null);

    // Notifikasi ke semua karyawan aktif (kecuali yg trigger SOS & sudah dapat notif admin)
    const peerIds = await this.getAllEmployeeIds(userId, adminIds);
    if (peerIds.length > 0) {
      this.notifications.sendMany(
        peerIds,
        'sos_alert',
        'SOS Darurat',
        `${senderName} mengaktifkan SOS. Apakah kamu berada di dekatnya?`,
      ).catch(() => null);
    }

    return saved;
  }

  // ── Update lokasi (dipanggil tiap 15 detik via WS atau REST) ─────────────
  async updateLocation(
    userId: string,
    alertId: string,
    lat: number,
    lng: number,
    batteryPct?: number,
  ): Promise<void> {
    const alert = await this.alertRepo.findOne({
      where: { id: alertId, user_id: userId, status: 'active' },
    });
    if (!alert) return;

    await this.alertRepo.update(alertId, {
      last_lat: lat,
      last_lng: lng,
      battery_pct: batteryPct ?? alert.battery_pct,
    });

    await this.trackRepo.save({
      alert_id: alertId,
      lat,
      lng,
      battery_pct: batteryPct ?? null,
    });
  }

  // ── Batalkan SOS (oleh karyawan) ─────────────────────────────────────────
  async cancel(userId: string): Promise<SosAlertEntity> {
    const alert = await this.alertRepo.findOne({
      where: { user_id: userId, status: 'active' },
    });
    if (!alert) throw new NotFoundException('Tidak ada SOS aktif');

    alert.status = 'cancelled';
    alert.resolved_at = new Date();
    return this.alertRepo.save(alert);
  }

  // ── Tandai direspons (manajer) ────────────────────────────────────────────
  async markResponded(alertId: string, responderId: string): Promise<SosAlertEntity> {
    const alert = await this.findActiveOrThrow(alertId);
    alert.status = 'responded';
    alert.responded_by = responderId;
    alert.responded_at = new Date();
    return this.alertRepo.save(alert);
  }

  // ── Tandai selesai (manajer) ──────────────────────────────────────────────
  async resolve(alertId: string, responderId: string, notes?: string): Promise<SosAlertEntity> {
    const alert = await this.findOrThrow(alertId);
    if (!['active', 'responded'].includes(alert.status)) {
      throw new BadRequestException('SOS sudah diselesaikan');
    }
    alert.status = 'resolved';
    alert.resolved_at = new Date();
    alert.responded_by = responderId;
    alert.notes = notes ?? null;
    return this.alertRepo.save(alert);
  }

  // ── List aktif (admin/manager) ────────────────────────────────────────────
  findActive() {
    return this.alertRepo.find({
      where: { status: 'active' },
      relations: ['user', 'tracks'],
      order: { activated_at: 'DESC' },
    });
  }

  // ── Riwayat SOS ──────────────────────────────────────────────────────────
  findHistory(limit = 100) {
    return this.alertRepo.find({
      relations: ['user', 'responder'],
      order: { activated_at: 'DESC' },
      take: limit,
    });
  }

  // ── Tracks untuk satu alert ───────────────────────────────────────────────
  getTracks(alertId: string) {
    return this.trackRepo.find({
      where: { alert_id: alertId },
      order: { recorded_at: 'ASC' },
    });
  }

  // ── SOS aktif milik user ──────────────────────────────────────────────────
  getMyActive(userId: string) {
    return this.alertRepo.findOne({
      where: { user_id: userId, status: 'active' },
    });
  }

  // ── Kontak darurat ────────────────────────────────────────────────────────
  getContacts() {
    return this.contactRepo.find({ order: { priority: 'ASC' } });
  }

  async addContact(name: string, role: string, phone: string, priority: number) {
    return this.contactRepo.save({ name, role, phone, priority });
  }

  async removeContact(id: string) {
    await this.contactRepo.delete(id);
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  private async findActiveOrThrow(alertId: string): Promise<SosAlertEntity> {
    const alert = await this.alertRepo.findOne({
      where: { id: alertId, status: 'active' },
    });
    if (!alert) throw new NotFoundException('SOS aktif tidak ditemukan');
    return alert;
  }

  private async findOrThrow(alertId: string): Promise<SosAlertEntity> {
    const alert = await this.alertRepo.findOneBy({ id: alertId });
    if (!alert) throw new NotFoundException('SOS tidak ditemukan');
    return alert;
  }

  private async getAdminManagerIds(): Promise<string[]> {
    const result = await this.alertRepo.manager.query(
      `SELECT u.id FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name IN ('admin','super_admin','manager') AND u.is_active = true`,
    );
    return result.map((r: any) => r.id);
  }

  // Semua karyawan aktif yang bukan trigger user dan belum dapat notif admin
  private async getAllEmployeeIds(
    excludeUserId: string,
    alreadyNotified: string[],
  ): Promise<string[]> {
    const result = await this.alertRepo.manager.query(
      `SELECT u.id FROM users u WHERE u.is_active = true`,
    );
    const allIds: string[] = result.map((r: any) => r.id);
    const excluded = new Set([excludeUserId, ...alreadyNotified]);
    return allIds.filter((id) => !excluded.has(id));
  }
}
