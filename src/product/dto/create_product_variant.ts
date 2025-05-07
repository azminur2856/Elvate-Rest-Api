import {
  IsString,
  IsNumber,
  IsUUID,
  IsOptional,
  IsDecimal,
  Min,
} from 'class-validator';

export class CreateProductVariantDto {
  @IsNumber()
  product_id: number;

  @IsString()
  variant_name: string;

  @IsDecimal()
  price: number;

  @IsNumber()
  @Min(1, { message: 'Stock must be greater than 0' })
  stock: number;

  @IsString()
  sku: string;

  // @IsOptional()
  // images: ProductImage[];
}
