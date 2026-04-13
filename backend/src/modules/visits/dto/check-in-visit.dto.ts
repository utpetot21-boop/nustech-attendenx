import { IsUUID, IsNumber, IsNotEmpty, Min, Max } from 'class-validator';

export class CheckInVisitDto {
  @IsUUID()
  @IsNotEmpty()
  task_id: string;

  @IsUUID()
  @IsNotEmpty()
  client_id: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}
