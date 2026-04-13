import { IsDateString, IsUUID } from 'class-validator';

export class AssignShiftDto {
  @IsUUID()
  user_id: string;

  @IsUUID()
  shift_type_id: string;

  @IsDateString()
  date: string;
}
