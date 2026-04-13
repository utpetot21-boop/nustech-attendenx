import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type BackupType = 'full' | 'incremental';
export type BackupStatus = 'running' | 'success' | 'failed';

@Entity('backup_history')
export class BackupHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, default: 'full' })
  type: BackupType;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status: BackupStatus;

  @Column({ type: 'bigint', nullable: true })
  size_bytes: number | null;

  @Column({ type: 'text', nullable: true })
  file_path: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum: string | null;

  @Column({ type: 'text', nullable: true })
  error_msg: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  triggered_by: string | null;
}
