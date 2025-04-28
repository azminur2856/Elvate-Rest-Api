import { IsOptional, IsEnum, IsNumber, IsBoolean, IsString, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductCategory } from '../enums/product-category.enum';

/**
 * Data Transfer Object for product query parameters.
 * @class ProductQueryDto
 * @description Defines the structure and validation rules for product filtering, pagination, and sorting.
 */
export class ProductQueryDto {
  /**
   * Page number for pagination.
   * @type {number}
   * @default 1
   */
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    minimum: 1
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  /**
   * Number of items per page.
   * @type {number}
   * @default 10
   */
  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    minimum: 1,
    maximum: 100
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  /**
   * Search term for filtering products by name or description.
   * @type {string}
   */
  @ApiPropertyOptional({
    description: 'Search term for product name or description',
    example: 'cotton'
  })
  @IsString()
  @IsOptional()
  search?: string;

  /**
   * Category filter for products.
   * @type {string}
   */
  @ApiPropertyOptional({
    description: 'Filter by product category',
    enum: ProductCategory
  })
  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  /**
   * Minimum price filter.
   * @type {number}
   */
  @ApiPropertyOptional({
    description: 'Filter by minimum price',
    example: 10.00
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  /**
   * Maximum price filter.
   * @type {number}
   */
  @ApiPropertyOptional({
    description: 'Filter by maximum price',
    example: 50.00
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  /**
   * Size filter for products.
   * @type {string}
   */
  @ApiPropertyOptional({
    description: 'Filter by size',
    example: 'M'
  })
  @IsString()
  @IsOptional()
  size?: string;

  /**
   * Color filter for products.
   * @type {string}
   */
  @ApiPropertyOptional({
    description: 'Filter by color',
    example: 'Black'
  })
  @IsString()
  @IsOptional()
  color?: string;

  /**
   * Brand filter for products.
   * @type {string}
   */
  @ApiPropertyOptional({
    description: 'Filter by brand',
    example: 'Elevate Fashion'
  })
  @IsString()
  @IsOptional()
  brand?: string;

  /**
   * Material filter for products.
   * @type {string}
   */
  @ApiPropertyOptional({
    description: 'Filter by material',
    example: 'Cotton'
  })
  @IsString()
  @IsOptional()
  material?: string;

  /**
   * Filter for featured products.
   * @type {boolean}
   */
  @ApiPropertyOptional({
    description: 'Filter featured products',
    default: undefined,
    type: Boolean
  })
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    return value === 'true';
  })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  /**
   * Filter for new arrival products.
   * @type {boolean}
   */
  @ApiPropertyOptional({
    description: 'Filter new arrivals',
    default: undefined,
    type: Boolean
  })
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    return value === 'true';
  })
  @IsBoolean()
  @IsOptional()
  isNewArrival?: boolean;

  /**
   * Filter for best seller products.
   * @type {boolean}
   */
  @ApiPropertyOptional({
    description: 'Filter best sellers',
    default: undefined,
    type: Boolean
  })
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    return value === 'true';
  })
  @IsBoolean()
  @IsOptional()
  isBestSeller?: boolean;

  /**
   * Filter for products on sale.
   * @type {boolean}
   */
  @ApiPropertyOptional({
    description: 'Filter products on sale',
    default: undefined,
    type: Boolean
  })
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    return value === 'true';
  })
  @IsBoolean()
  @IsOptional()
  isOnSale?: boolean;

  /**
   * Field to sort products by.
   * @type {string}
   * @default 'createdAt'
   */
  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'price'
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  /**
   * Sort order (ASC or DESC).
   * @type {'ASC' | 'DESC'}
   * @default 'DESC'
   */
  @ApiPropertyOptional({
    description: 'Sort order (asc or desc)',
    example: 'asc',
    enum: ['asc', 'desc']
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'asc';
} 