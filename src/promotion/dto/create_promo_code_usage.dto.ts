import { IsNumber, IsDateString } from 'class-validator';

export class CreatePromoCodeUsageDto {
  @IsNumber()
  user_id: number; // or string if UUID

  @IsNumber()
  coupon_id: number;

  @IsDateString()
  used_at: string;
}
