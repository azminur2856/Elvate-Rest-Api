import { IsString, IsNotEmpty, IsNumber, IsUUID } from 'class-validator';

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

  @IsUUID()
  @IsNotEmpty()
  created_by: string;
}
