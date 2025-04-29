import { IsString, IsNotEmpty, IsNumber, IsEnum, IsArray, IsOptional, IsBoolean, IsUrl, Min, Max, IsObject, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductCategory } from '../entities/product.entity';

export class CreateProductDto {
  @ApiProperty({
    description: 'Name of the product',
    example: 'Classic Fit Cotton T-Shirt'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of the product',
    example: 'Premium quality cotton t-shirt with a comfortable classic fit. Perfect for everyday wear.'
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Price of the product',
    example: 29.99,
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    description: 'Sale price of the product (if on sale)',
    example: 24.99,
    required: false
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number;

  @ApiProperty({
    description: 'Stock quantity of the product',
    example: 100,
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiProperty({
    description: 'Category of the product',
    enum: ProductCategory,
    example: ProductCategory.T_SHIRTS
  })
  @IsEnum(ProductCategory)
  category: ProductCategory;

  @ApiProperty({
    description: 'Available sizes',
    example: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  })
  @IsArray()
  @IsString({ each: true })
  sizes: string[];

  @ApiProperty({
    description: 'Available colors',
    example: ['Black', 'White', 'Navy', 'Burgundy', 'Forest Green']
  })
  @IsArray()
  @IsString({ each: true })
  colors: string[];

  @ApiProperty({
    description: 'URL of the product image',
    example: 'https://example.com/images/classic-fit-tshirt.jpg',
    required: false
  })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Product specifications',
    example: { 
      'Fabric': '100% Premium Cotton', 
      'Fit': 'Classic Fit',
      'Weight': '180 GSM',
      'Style': 'Casual',
      'Neck': 'Crew Neck'
    }
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
    example: '100% Premium Cotton'
  })
  @IsString()
  @IsOptional()
  material?: string;

  @ApiPropertyOptional({
    description: 'Care instructions',
    example: 'Machine wash cold, tumble dry low. Do not bleach. Iron on reverse side if needed.'
  })
  @IsString()
  @IsOptional()
  careInstructions?: string;

  @ApiPropertyOptional({
    description: 'Whether the product is featured',
    example: false,
    required: false
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
  @Transform(({ value }) => value === 'true')
  isNewArrival?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the product is a best seller',
    default: false
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isBestSeller?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the product is on sale',
    example: false,
    required: false
  })
  @IsBoolean()
  @IsOptional()
  isOnSale?: boolean;
} 