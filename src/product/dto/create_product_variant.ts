import {
  IsString,
  IsNumber,
  IsUUID,
  IsOptional,
  IsDecimal,
} from 'class-validator';

export class CreateProductVariantDto {
  @IsNumber()
  product_id: number;

  @IsString()
  variant_name: string;

  @IsDecimal()
  price: number;

  @IsNumber()
  stock: number;

  @IsString()
  sku: string;

  // @IsOptional()
  // images: ProductImage[];
}
