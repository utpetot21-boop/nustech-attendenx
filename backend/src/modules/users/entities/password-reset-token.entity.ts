import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserEntity } from './user.entity';

@Entity('password_reset_tokens')
export class PasswordResetTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar' })
  token_hash: string; // hash dari OTP 6 digit

  @Column({ type: 'timestamptz' })
  expires_at: Date; // berlaku 15 menit

  @Column({ type: 'timestamptz', nullable: true })
  used_at: Date | null;

  @Column({ type: 'varchar', length: 10, enum: ['email', 'whatsapp'] })
  channel: 'email' | 'whatsapp';

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
