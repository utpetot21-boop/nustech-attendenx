import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'returnAfterDepart', async: false })
class ReturnAfterDepart implements ValidatorConstraintInterface {
  validate(returnDate: string, args: ValidationArguments) {
    const obj = args.object as CreateBusinessTripDto;
    if (!obj.depart_date || !returnDate) return true;
    return returnDate >= obj.depart_date;
  }
  defaultMessage() {
    return 'return_date harus >= depart_date';
  }
}

export class CreateBusinessTripDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  destination: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;

  @IsDateString()
  depart_date: string;

  @IsDateString()
  @Validate(ReturnAfterDepart)
  return_date: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  transport_mode?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  estimated_cost?: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  advance_amount?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
