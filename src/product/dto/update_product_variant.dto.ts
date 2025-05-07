import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsInt,
  IsDecimal,
  Min,
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

  // @IsOptional()
  @IsInt()
  @Min(1, { message: 'Amount must be greater than 0' })
  stock: number;

  @IsOptional()
  @IsString()
  sku?: string;
}
