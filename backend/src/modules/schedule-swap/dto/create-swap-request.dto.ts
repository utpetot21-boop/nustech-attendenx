import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { SwapType } from '../entities/schedule-swap-request.entity';

export class CreateSwapRequestDto {
  @IsEnum(['with_person', 'with_own_dayoff'])
  type: SwapType;

  /** Tanggal jadwal kerja requester yang ingin ditukar */
  @IsDateString()
  requester_date: string;

  /** Tanggal yang diinginkan (hari libur target / hari libur sendiri) */
  @IsDateString()
  target_date: string;

  /** Wajib jika type = with_person */
  @IsOptional()
  @IsUUID()
  target_user_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
