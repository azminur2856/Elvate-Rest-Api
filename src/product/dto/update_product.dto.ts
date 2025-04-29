import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  base_price?: number;

  @IsNumber()
  @IsOptional()
  brand_id?: number;

  @IsNumber()
  @IsOptional()
  category_id?: number;

  @IsNumber()
  @IsOptional()
  updated_by?: string;
}
