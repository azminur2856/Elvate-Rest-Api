import { IsString, IsNotEmpty, IsNumber, IsUUID, IsInt } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  base_price: number;

  @IsNumber()
  brand_id: number;

  @IsNumber()
  category_id: number;

  // @IsNumber()
  // @IsNotEmpty()
  // created_by: number;

  @IsNumber()
  // @IsInt()
  created_by: number;
}
