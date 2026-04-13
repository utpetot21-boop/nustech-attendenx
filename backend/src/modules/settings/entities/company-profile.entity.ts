import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('company_profile')
export class CompanyProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200, default: 'Nustech' })
  name: string;

  @Column({ type: 'text', default: '' })
  address: string;

  @Column({ type: 'varchar', length: 30, default: '' })
  phone: string;

  @Column({ type: 'varchar', length: 150, default: '' })
  email: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  website: string;

  @Column({ type: 'text', nullable: true })
  logo_url: string | null;

  @UpdateDateColumn()
  updated_at: Date;
}
