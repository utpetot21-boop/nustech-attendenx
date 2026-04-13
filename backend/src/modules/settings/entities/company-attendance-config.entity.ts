import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('company_attendance_config')
export class CompanyAttendanceConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer', default: 60 })
  late_tolerance_minutes: number;

  @Column({ type: 'integer', default: 4 })
  alfa_threshold_hours: number;

  @Column({ type: 'integer', default: 24 })
  objection_window_hours: number;

  @Column({ type: 'integer', default: 100 })
  check_in_radius_meter: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  office_lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  office_lng: number | null;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  effective_date: string;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @UpdateDateColumn()
  updated_at: Date;
}
