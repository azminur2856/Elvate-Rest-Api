import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const MAX_PER_LINE = 10;
export const MAX_LINES = 50;

export class AddCartItemDto {
  @IsUUID()
  variantId: string;

  @IsInt()
  @Min(1)
  @Max(MAX_PER_LINE)
  quantity: number;
}

export class UpdateCartItemDto {
  /** 0 removes the line. */
  @IsInt()
  @Min(0)
  @Max(MAX_PER_LINE)
  quantity: number;
}

/** A guest cart line (localStorage). Quantities above the caps are clamped, not rejected. */
export class GuestCartLineDto {
  @IsUUID()
  variantId: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;
}

export class GuestCartDto {
  @IsArray()
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => GuestCartLineDto)
  items: GuestCartLineDto[];
}
