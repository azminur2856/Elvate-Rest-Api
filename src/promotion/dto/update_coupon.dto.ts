import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
} from 'class-validator';

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Flat', 'Percentage'])
  type?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;

  @IsOptional()
  @IsNumber()
  usage_limit?: number;
}
