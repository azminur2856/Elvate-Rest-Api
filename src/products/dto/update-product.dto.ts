import { IsString, IsNumber, IsEnum, IsArray, IsOptional, IsBoolean, IsUrl, Min, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductCategory } from '../entities/product.entity';

export class UpdateProductDto {
  @ApiProperty({
    description: 'Name of the product',
    example: 'Premium Slim Fit Denim Jeans',
    required: false
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Description of the product',
    example: 'High-quality denim jeans with a modern slim fit. Features stretch comfort and classic five-pocket styling.',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Price of the product',
    example: 79.99,
    minimum: 0,
    required: false
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({
    description: 'Sale price of the product (if on sale)',
    example: 59.99,
    required: false
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number;

  @ApiProperty({
    description: 'Stock quantity of the product',
    example: 150,
    minimum: 0,
    required: false
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @ApiProperty({
    description: 'Category of the product',
    enum: ProductCategory,
    example: ProductCategory.PANTS,
    required: false
  })
  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @ApiProperty({
    description: 'Whether the product is featured',
    example: true,
    required: false
  })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiProperty({
    description: 'Whether the product is on sale',
    example: true,
    required: false
  })
  @IsBoolean()
  @IsOptional()
  isOnSale?: boolean;

  @ApiProperty({
    description: 'URL of the product image',
    example: 'https://example.com/images/premium-denim-jeans.jpg',
    required: false
  })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Discounted price (if on sale)',
    example: 59.99
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountedPrice?: number;

  @ApiPropertyOptional({
    description: 'Stock quantity',
    example: 100
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stockQuantity?: number;

  @ApiPropertyOptional({
    description: 'Available sizes',
    example: ['28', '30', '32', '34', '36', '38']
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sizes?: string[];

  @ApiPropertyOptional({
    description: 'Available colors',
    example: ['Dark Blue', 'Black', 'Light Wash', 'Medium Wash']
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  colors?: string[];

  @ApiPropertyOptional({
    description: 'Product image URLs',
    example: [
      'https://example.com/images/jeans-front.jpg',
      'https://example.com/images/jeans-back.jpg',
      'https://example.com/images/jeans-detail.jpg'
    ]
  })
  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({
    description: 'Product specifications',
    example: { 
      'Fabric': '98% Cotton, 2% Elastane',
      'Fit': 'Slim Fit',
      'Rise': 'Mid Rise',
      'Closure': 'Button and Zip',
      'Pockets': '5 Pockets'
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
    example: '98% Cotton, 2% Elastane'
  })
  @IsString()
  @IsOptional()
  material?: string;

  @ApiPropertyOptional({
    description: 'Care instructions',
    example: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Iron on reverse side if needed.'
  })
  @IsString()
  @IsOptional()
  careInstructions?: string;

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
    description: 'Whether the product is active',
    default: true
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
} 