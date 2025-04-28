import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
} from 'class-validator';

export class UpdateProductImageDto {
  @IsOptional()
  @IsString()
  image_url?: string[];

  @IsOptional()
  @IsBoolean()
  is_main?: boolean;

  @IsOptional()
  @IsNumber()
  product_id?: number;

  @IsOptional()
  @IsNumber()
  variant_id?: number;
}
