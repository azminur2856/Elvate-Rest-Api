import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/pagination';

/** "true"/"1" → true, "false"/"0" → false, anything else stays as-is (→ 400). */
const toBool = ({ value }: { value: unknown }) =>
  value === 'true' || value === '1' || value === true
    ? true
    : value === 'false' || value === '0' || value === false
      ? false
      : value;

/** "M, L ,XL" → ["M","L","XL"] (also accepts repeated ?sizes=M&sizes=L). */
const toList = ({ value }: { value: unknown }): string[] | undefined => {
  const parts = (Array.isArray(value) ? value : [value])
    .flatMap((v) => (typeof v === 'string' ? v.split(',') : []))
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts.slice(0, 30) : undefined;
};

export const PRODUCT_SORTS = [
  'newest',
  'price_asc',
  'price_desc',
  'popular',
  'rating',
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export class ProductListQueryDto extends PaginationQueryDto {
  /** Category slug; includes all sub-categories. */
  @IsOptional()
  @IsString()
  @MaxLength(140)
  category?: string;

  /** Case-insensitive search in name, brand and description. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(toList)
  @IsString({ each: true })
  sizes?: string[];

  @IsOptional()
  @Transform(toList)
  @IsString({ each: true })
  colors?: string[];

  /** One brand, or several comma-separated. */
  @IsOptional()
  @Transform(toList)
  @IsString({ each: true })
  brand?: string[];

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  onSale?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  newArrival?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;
}

export class FiltersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  category?: string;
}

export class RelatedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number;
}
