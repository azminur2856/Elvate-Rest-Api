import { IsNumber, IsDateString } from 'class-validator';

export class CreateFlashSaleDto {
  @IsNumber()
  product_id: number;

  @IsNumber()
  discount: number;

  @IsDateString()
  start_time: string;

  @IsDateString()
  end_time: string;

  is_active?: boolean; // optional, default true if not provided
}
