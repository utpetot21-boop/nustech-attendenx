import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VisitEntity } from './visit.entity';
import { ClientEntity } from '../../clients/entities/client.entity';

@Entity('sla_breaches')
export class SlaBreachEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  visit_id: string;

  @ManyToOne(() => VisitEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visit_id' })
  visit: VisitEntity;

  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => ClientEntity)
  @JoinColumn({ name: 'client_id' })
  client: ClientEntity;

  @Column({ type: 'varchar', length: 20 })
  breach_type: 'response' | 'completion';

  @Column({ type: 'int' })
  sla_hours: number;

  @Column({ type: 'int' })
  actual_hours: number;

  @CreateDateColumn()
  breached_at: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
