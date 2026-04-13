import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AnnouncementEntity } from './announcement.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('announcement_reads')
export class AnnouncementReadEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  announcement_id: string;

  @ManyToOne(() => AnnouncementEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'announcement_id' })
  announcement: AnnouncementEntity;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  read_at: Date;
}
