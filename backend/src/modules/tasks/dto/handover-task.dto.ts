import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class HandoverTaskDto {
  @IsUUID()
  to_user_id: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
