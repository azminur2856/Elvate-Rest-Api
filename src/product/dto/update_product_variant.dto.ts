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
  product_id?: string; // Optional, if you want to update the associated product ID

  @IsOptional()
  @IsString()
  variant_name?: string; // Optional, if you want to update the variant name

  @IsOptional()
  @IsDecimal()
  price?: number; // Optional, if you want to update the price

  @IsOptional()
  @IsInt()
  stock?: number; // Optional, if you want to update the stock

  @IsOptional()
  @IsString()
  sku?: string; // Optional, if you want to update the SKU
}
