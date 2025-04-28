import { IsOptional, IsNumber, IsDateString } from 'class-validator';

export class UpdatePromoCodeUsageDto {
  @IsOptional()
  @IsNumber()
  user_id?: number;

  @IsOptional()
  @IsNumber()
  coupon_id?: number;

  @IsOptional()
  @IsDateString()
  used_at?: string;
}
