import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('company_expense_config')
export class ExpenseConfigEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  category: string;

  @Column({ type: 'integer', default: 0 })
  max_amount: number;

  @Column({ type: 'integer', default: 50000 })
  receipt_required_above: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @UpdateDateColumn() updated_at: Date;
}
