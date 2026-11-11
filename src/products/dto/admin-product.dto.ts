import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/pagination';
import { SLUG_PATTERN } from 'src/common/slug';

const MAX_PRICE = 10_000_000;
const money = { maxDecimalPlaces: 2 };
/** `null` is a real value on PATCH ("clear it"), so only skip validation for undefined/null. */
const nullable = ValidateIf((_, v) => v !== null && v !== undefined);
const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

/** `{ "Fabric": "Cotton", "Fit": "Slim" }`: ≤ 50 keys, string values. */
@ValidatorConstraint({ name: 'stringRecord' })
class StringRecord implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      entries.length <= 50 &&
      entries.every(
        ([k, v]) =>
          k.trim().length > 0 &&
          k.length <= 60 &&
          typeof v === 'string' &&
          v.length <= 500,
      )
    );
  }
  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be an object of up to 50 "name": "value" text pairs`;
  }
}

export class VariantInputDto {
  @IsOptional()
  @nullable
  @trim
  @IsString()
  @Length(1, 40)
  size?: string | null;

  @IsOptional()
  @nullable
  @trim
  @IsString()
  @Length(1, 40)
  color?: string | null;

  /** Optional; generated as `<SLUG>-<SIZE>-<COLOR>` (uppercase). */
  @IsOptional()
  @Matches(/^[A-Z0-9][A-Z0-9-]{0,79}$/, {
    message: 'sku must be uppercase letters, digits and dashes (max 80)',
  })
  sku?: string;

  @IsInt()
  @Min(0)
  @Max(100_000)
  stock: number;

  /** Overrides the product price; `null` (on PATCH) removes the override. */
  @IsOptional()
  @nullable
  @IsNumber(money)
  @Min(0)
  @Max(MAX_PRICE)
  price?: number | null;
}

export class UpdateVariantDto {
  @IsOptional()
  @nullable
  @trim
  @IsString()
  @Length(1, 40)
  size?: string | null;

  @IsOptional()
  @nullable
  @trim
  @IsString()
  @Length(1, 40)
  color?: string | null;

  @IsOptional()
  @Matches(/^[A-Z0-9][A-Z0-9-]{0,79}$/, {
    message: 'sku must be uppercase letters, digits and dashes (max 80)',
  })
  sku?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  stock?: number;

  @IsOptional()
  @nullable
  @IsNumber(money)
  @Min(0)
  @Max(MAX_PRICE)
  price?: number | null;
}

class ProductFieldsDto {
  @IsOptional()
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (a-z, 0-9, -)',
  })
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @nullable
  @trim
  @IsString()
  @MaxLength(120)
  brand?: string | null;

  @IsOptional()
  @nullable
  @IsNumber(money)
  @Min(0)
  @Max(MAX_PRICE)
  salePrice?: number | null;

  @IsOptional()
  @nullable
  @trim
  @IsString()
  @MaxLength(200)
  material?: string | null;

  @IsOptional()
  @nullable
  @IsString()
  @MaxLength(2000)
  careInstructions?: string | null;

  @IsOptional()
  @IsObject()
  @Validate(StringRecord)
  specifications?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isNewArrival?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductDto extends ProductFieldsDto {
  @trim
  @IsString()
  @Length(1, 200)
  name: string;

  @IsString()
  @MaxLength(10_000)
  description: string;

  @IsUUID()
  categoryId: string;

  @IsNumber(money)
  @Min(0)
  @Max(MAX_PRICE)
  price: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'a product needs at least one variant' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants: VariantInputDto[];
}

/** Same as create minus `variants`, all optional; `null` clears brand/salePrice/material/careInstructions. */
export class UpdateProductDto extends ProductFieldsDto {
  @IsOptional()
  @trim
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsNumber(money)
  @Min(0)
  @Max(MAX_PRICE)
  price?: number;
}

export class UpdateImageDto {
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class AdminProductQueryDto extends PaginationQueryDto {
  /** Name, brand, slug or SKU. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** Category slug, includes sub-categories. */
  @IsOptional()
  @IsString()
  @MaxLength(140)
  category?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status?: 'active' | 'inactive' | 'all';

  /** `out` = total stock 0; `low` = still in stock but some variant has ≤ 5. */
  @IsOptional()
  @IsIn(['low', 'out'])
  stock?: 'low' | 'out';
}
