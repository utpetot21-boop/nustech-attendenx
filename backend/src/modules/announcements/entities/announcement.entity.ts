import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

export type AnnouncementType = 'info' | 'urgent' | 'holiday' | 'policy';
export type TargetType = 'all' | 'department' | 'individual';
export type AnnouncementStatus = 'draft' | 'sent' | 'expired';

@Entity('announcements')
export class AnnouncementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 20, default: 'info' })
  type: AnnouncementType;

  @Column({ type: 'varchar', length: 20, default: 'all' })
  target_type: TargetType;

  @Column({ type: 'uuid', nullable: true })
  target_dept_id: string | null;

  @Column({ type: 'uuid', array: true, nullable: true })
  target_user_ids: string[] | null;

  @Column({ type: 'boolean', default: false })
  is_pinned: boolean;

  @Column({ type: 'date', nullable: true })
  pinned_until: string | null;

  @Column({ type: 'boolean', default: true })
  send_push: boolean;

  @Column({ type: 'boolean', default: false })
  send_whatsapp: boolean;

  @Column({ type: 'text', nullable: true })
  attachment_url: string | null;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: AnnouncementStatus;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'uuid' })
  created_by: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator: UserEntity;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
