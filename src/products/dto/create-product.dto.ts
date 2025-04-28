import { IsString, IsNotEmpty, IsNumber, IsEnum, IsArray, IsOptional, IsBoolean, IsUrl, Min, Max, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductCategory } from '../enums/product-category.enum';

export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Classic Cotton T-Shirt'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Product description',
    example: 'A comfortable and stylish cotton t-shirt perfect for everyday wear.'
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Product price',
    example: 29.99
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description: 'Discounted price (if on sale)',
    example: 24.99
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountedPrice?: number;

  @ApiProperty({
    description: 'Stock quantity',
    example: 100
  })
  @IsNumber()
  @Min(0)
  stockQuantity: number;

  @ApiProperty({
    description: 'Product category',
    enum: ProductCategory,
    example: ProductCategory.T_SHIRTS
  })
  @IsEnum(ProductCategory)
  category: ProductCategory;

  @ApiProperty({
    description: 'Available sizes',
    example: ['S', 'M', 'L', 'XL']
  })
  @IsArray()
  @IsString({ each: true })
  sizes: string[];

  @ApiProperty({
    description: 'Available colors',
    example: ['Black', 'White', 'Navy']
  })
  @IsArray()
  @IsString({ each: true })
  colors: string[];

  @ApiProperty({
    description: 'Product image URLs',
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg']
  })
  @IsArray()
  @IsUrl({}, { each: true })
  images: string[];

  @ApiPropertyOptional({
    description: 'Product specifications',
    example: { 'Fabric': '100% Cotton', 'Fit': 'Regular' }
  })
  @IsObject()
  @IsOptional()
  specifications?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Product brand',
    example: 'Elevate Fashion'
  })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Product material',
    example: '100% Cotton'
  })
  @IsString()
  @IsOptional()
  material?: string;

  @ApiPropertyOptional({
    description: 'Care instructions',
    example: 'Machine wash cold, tumble dry low'
  })
  @IsString()
  @IsOptional()
  careInstructions?: string;

  @ApiPropertyOptional({
    description: 'Whether the product is featured',
    default: false
  })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the product is a new arrival',
    default: false
  })
  @IsBoolean()
  @IsOptional()
  isNewArrival?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the product is a best seller',
    default: false
  })
  @IsBoolean()
  @IsOptional()
  isBestSeller?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the product is on sale',
    default: false
  })
  @IsBoolean()
  @IsOptional()
  isOnSale?: boolean;
} 