import {
  Column, CreateDateColumn, Entity, JoinColumn,
  ManyToOne, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { SosLocationTrackEntity } from './sos-location-track.entity';

@Entity('sos_alerts')
export class SosAlertEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  activated_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  last_lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  last_lng: number | null;

  @Column({ type: 'varchar', nullable: true })
  last_address: string | null;

  @Column({ type: 'integer', nullable: true })
  battery_pct: number | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'responded' | 'resolved' | 'cancelled';

  @Column({ type: 'uuid', nullable: true })
  responded_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'responded_by' })
  responder: UserEntity;

  @Column({ type: 'timestamptz', nullable: true })
  responded_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => SosLocationTrackEntity, (t) => t.alert)
  tracks: SosLocationTrackEntity[];

  @CreateDateColumn() created_at: Date;
}
