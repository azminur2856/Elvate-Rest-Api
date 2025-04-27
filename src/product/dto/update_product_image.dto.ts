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
  image_url?: string[]; // Optional, if you want to update the image URL

  @IsOptional()
  @IsBoolean()
  is_main?: boolean; // Optional, if you want to update whether the image is the main image

  @IsOptional()
  @IsNumber()
  product_id?: number; // Optional, if you want to update the associated product ID

  @IsOptional()
  @IsNumber()
  variant_id?: number; // Optional, if you want to update the associated variant ID
}
