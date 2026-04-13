import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('emergency_contacts')
export class EmergencyContactEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) role: string | null;
  @Column({ type: 'varchar', length: 20 }) phone: string;
  @Column({ type: 'integer', default: 1 }) priority: number;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @CreateDateColumn() created_at: Date;
}
