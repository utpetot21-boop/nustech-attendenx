import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntity } from '../../users/entities/user.entity';

@Entity('locations')
export class LocationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  lng: number;

  @Column({ type: 'integer', default: 100 })
  radius_meter: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => UserEntity, (user) => user.location)
  users: UserEntity[];
}
