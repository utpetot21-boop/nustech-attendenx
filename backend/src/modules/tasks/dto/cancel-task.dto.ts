import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CancelTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Alasan pembatalan wajib diisi.' })
  @MinLength(5, { message: 'Alasan pembatalan minimal 5 karakter.' })
  @MaxLength(500, { message: 'Alasan pembatalan maksimal 500 karakter.' })
  reason: string;
}
