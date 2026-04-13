import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { UserEntity } from './user.entity';

@Entity('user_devices')
@Unique(['user_id', 'fcm_token'])
export class UserDeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar' })
  fcm_token: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  device_name: string | null;

  @Column({ type: 'varchar', length: 10, enum: ['android', 'ios', 'web'] })
  platform: 'android' | 'ios' | 'web';

  @Column({ type: 'varchar', length: 20, nullable: true })
  app_version: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  last_active_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
