import {
  IsString,
  IsNumber,
  IsUUID,
  IsOptional,
  IsDecimal,
} from 'class-validator';
import { ProductImage } from '../entities/product_image.entity';

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
  // images: ProductImage[]; // Optional array of image URLs or image IDs if you need to send images alongside variant creation
}
