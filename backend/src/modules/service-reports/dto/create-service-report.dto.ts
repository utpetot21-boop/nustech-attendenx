import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateServiceReportDto {
  /** Nama PIC dari sisi klien (opsional saat pembuatan) */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  client_pic_name?: string;
}
