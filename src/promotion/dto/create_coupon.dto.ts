import { IsString, IsNumber, IsDateString, IsIn, Min } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsString()
  @IsIn(['Flat', 'Percentage'])
  type: string;

  @IsNumber()
  value: number;

  @IsDateString()
  expiry_date: string;

  @IsNumber()
  usage_limit: number;

  @IsNumber()
  @Min(0)
  usage_count?: number;
}
