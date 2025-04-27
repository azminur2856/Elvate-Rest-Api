import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsUrl,
  IsDate,
  IsNumber,
} from 'class-validator';

export class CreateProductImageDto {
  @IsNumber()
  product_id: number;

  @IsNumber()
  @IsOptional()
  variant_id: number;

  @IsString()
  image_url: string[];

  @IsBoolean()
  is_main: boolean;

  @IsDate()
  @IsOptional() // Optional as it may be set on creation, but not required
  created_at: Date;

  @IsDate()
  @IsOptional() // Optional for when the image is updated
  updated_at: Date;
}
