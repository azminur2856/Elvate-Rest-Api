import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/pagination';
import { CouponType } from '../entities/coupon.entity';

const upperTrim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value,
);
const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);
/** `null` is a value on PATCH (clear / no limit). */
const nullable = ValidateIf((_, v) => v !== null && v !== undefined);
const money = { maxDecimalPlaces: 2 };
const CODE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const CODE_MSG = 'code must be 3–40 letters, digits, "-" or "_"';

class CouponFields {
  @IsOptional()
  @nullable
  @trim
  @IsString()
  @MaxLength(255)
  description?: string | null;

  @IsOptional()
  @nullable
  @IsNumber(money)
  @Min(0)
  minOrderAmount?: number | null;

  /** Only used by PERCENT coupons. */
  @IsOptional()
  @nullable
  @IsNumber(money)
  @Min(1)
  maxDiscount?: number | null;

  @IsOptional()
  @nullable
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  @IsOptional()
  @nullable
  @IsInt()
  @Min(1)
  perUserLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCouponDto extends CouponFields {
  @upperTrim
  @Matches(CODE, { message: CODE_MSG })
  code: string;

  @IsEnum(CouponType)
  type: CouponType;

  /** Percent (1–100) for PERCENT, taka for FIXED. */
  @IsNumber(money)
  @Min(0.01)
  value: number;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  expiresAt: string;
}

export class UpdateCouponDto extends CouponFields {
  @IsOptional()
  @upperTrim
  @Matches(CODE, { message: CODE_MSG })
  code?: string;

  @IsOptional()
  @IsEnum(CouponType)
  type?: CouponType;

  @IsOptional()
  @IsNumber(money)
  @Min(0.01)
  value?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class CouponQueryDto extends PaginationQueryDto {
  @IsOptional()
  @trim
  @IsString()
  @MaxLength(40)
  q?: string;

  /** active = enabled and not expired yet (incl. scheduled); expired; inactive = switched off */
  @IsOptional()
  @IsIn(['active', 'expired', 'inactive'])
  status?: 'active' | 'expired' | 'inactive';
}

export class CreateFlashSaleDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @nullable
  @trim
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  discountPercent: number;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFlashSaleDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @nullable
  @trim
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  discountPercent?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class FlashSaleQueryDto extends PaginationQueryDto {
  /** live = running now; scheduled = starts later; ended = over or switched off */
  @IsOptional()
  @IsIn(['live', 'scheduled', 'ended'])
  status?: 'live' | 'scheduled' | 'ended';
}
