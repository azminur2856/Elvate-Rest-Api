import { IsOptional, IsNumber, IsDateString, IsBoolean } from 'class-validator';

export class UpdateFlashSaleDto {
  @IsOptional()
  @IsNumber()
  product_id?: number;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsDateString()
  start_time?: string;

  @IsOptional()
  @IsDateString()
  end_time?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
