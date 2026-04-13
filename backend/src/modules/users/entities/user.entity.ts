import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { ScheduleType } from '@nustech/shared';
import { DepartmentEntity } from '../../departments/entities/department.entity';
import { LocationEntity } from '../../locations/entities/location.entity';
import { RoleEntity } from '../../roles/entities/role.entity';
import { PositionEntity } from '../../positions/entities/position.entity';
import { ShiftTypeEntity } from '../../schedule/entities/shift-type.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { UserDeviceEntity } from './user-device.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  employee_id: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  nik: string | null;

  @Column({ type: 'varchar', length: 100 })
  full_name: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', select: false })
  password_hash: string;

  @Column({ type: 'uuid' })
  role_id: string;

  @ManyToOne(() => RoleEntity, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role: RoleEntity;

  @Column({ type: 'uuid', nullable: true })
  position_id: string | null;

  @ManyToOne(() => PositionEntity, { nullable: true, eager: false })
  @JoinColumn({ name: 'position_id' })
  position: PositionEntity | null;

  @Column({ type: 'uuid', nullable: true })
  department_id: string | null;

  @ManyToOne(() => DepartmentEntity, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: DepartmentEntity | null;

  @Column({ type: 'uuid', nullable: true })
  location_id: string | null;

  @ManyToOne(() => LocationEntity, { nullable: true })
  @JoinColumn({ name: 'location_id' })
  location: LocationEntity | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    enum: ['shift', 'office_hours'],
  })
  schedule_type: ScheduleType | null;

  @Column({ type: 'uuid', nullable: true })
  default_shift_type_id: string | null;

  @ManyToOne(() => ShiftTypeEntity, { nullable: true, eager: false })
  @JoinColumn({ name: 'default_shift_type_id' })
  default_shift_type: ShiftTypeEntity | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  pin_hash: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender: 'male' | 'female' | null;

  @Column({ type: 'varchar', nullable: true })
  avatar_url: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: true })
  must_change_password: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_login_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => RefreshTokenEntity, (rt) => rt.user)
  refresh_tokens: RefreshTokenEntity[];

  @OneToMany(() => UserDeviceEntity, (d) => d.user)
  devices: UserDeviceEntity[];

  @BeforeInsert()
  @BeforeUpdate()
  lowercaseEmail() {
    this.email = this.email.toLowerCase().trim();
  }
}
