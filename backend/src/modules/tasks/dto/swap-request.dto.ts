import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SwapRequestDto {
  @IsUUID()
  to_user_id: string;

  @IsUUID()
  swap_task_id: string; // tugas milik to_user_id yang ingin ditukar

  @IsString()
  @IsNotEmpty()
  reason: string;
}
