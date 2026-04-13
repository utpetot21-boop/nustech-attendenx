import {
  Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { SosAlertEntity } from './sos-alert.entity';

@Entity('sos_location_tracks')
export class SosLocationTrackEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' })
  alert_id: string;

  @ManyToOne(() => SosAlertEntity, (a) => a.tracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alert_id' })
  alert: SosAlertEntity;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  lng: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  accuracy: number | null;

  @Column({ type: 'integer', nullable: true })
  battery_pct: number | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  recorded_at: Date;
}
