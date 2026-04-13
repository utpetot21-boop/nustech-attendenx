import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class DelegateTaskDto {
  @IsUUID()
  to_user_id: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsEnum(['delegate', 'swap'])
  @IsOptional()
  type?: 'delegate' | 'swap';

  @IsUUID()
  @IsOptional()
  swap_task_id?: string; // for swap only
}
