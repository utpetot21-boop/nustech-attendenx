import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { Role } from '@nustech/shared';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('roles')
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  name: Role;

  @Column({ type: 'jsonb', nullable: true })
  permissions: string[];

  @Column({ type: 'boolean', default: false })
  can_delegate: boolean;

  @Column({ type: 'boolean', default: false })
  can_approve: boolean;

  @Column({ type: 'boolean', default: false })
  is_system: boolean;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => UserEntity, (user) => user.role)
  users: UserEntity[];
}
