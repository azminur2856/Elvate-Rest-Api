import { IsNumber, IsDateString } from 'class-validator';

export class CreatePromoCodeUsageDto {
  @IsNumber()
  user_id: number;

  @IsNumber()
  coupon_id: number;

  @IsDateString()
  used_at: string;
}
