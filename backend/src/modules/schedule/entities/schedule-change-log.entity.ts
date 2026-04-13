import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { ShiftTypeEntity } from './shift-type.entity';

@Entity('schedule_change_logs')
export class ScheduleChangeLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid' })
  changed_by: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'changed_by' })
  changer: UserEntity;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'uuid', nullable: true })
  old_shift_type_id: string | null;

  @ManyToOne(() => ShiftTypeEntity, { nullable: true })
  @JoinColumn({ name: 'old_shift_type_id' })
  old_shift_type: ShiftTypeEntity | null;

  @Column({ type: 'uuid', nullable: true })
  new_shift_type_id: string | null;

  @ManyToOne(() => ShiftTypeEntity, { nullable: true })
  @JoinColumn({ name: 'new_shift_type_id' })
  new_shift_type: ShiftTypeEntity | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  created_at: Date;
}
