import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { DepartmentEntity } from '../../departments/entities/department.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('shift_types')
export class ShiftTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'time' })
  start_time: string;

  @Column({ type: 'time' })
  end_time: string;

  // Durasi dihitung di aplikasi, bukan generated column (lebih portable)
  @Column({ type: 'integer' })
  duration_minutes: number;

  @Column({ type: 'integer', default: 60 })
  tolerance_minutes: number;

  @Column({ type: 'varchar', length: 7, default: '#007AFF' })
  color_hex: string;

  @Column({ type: 'uuid', nullable: true })
  department_id: string | null;

  @ManyToOne(() => DepartmentEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: DepartmentEntity | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: UserEntity | null;

  @CreateDateColumn()
  created_at: Date;
}
