import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsInt,
  IsDecimal,
} from 'class-validator';

export class UpdateProductVariantDto {
  @IsOptional()
  @IsNumber()
  product_id?: string;

  @IsOptional()
  @IsString()
  variant_name?: string;

  @IsOptional()
  @IsDecimal()
  price?: number;

  @IsOptional()
  @IsInt()
  stock?: number;

  @IsOptional()
  @IsString()
  sku?: string;
}
