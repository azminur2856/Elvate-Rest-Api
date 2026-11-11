import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);
/** Optional text: `null` or "" clears it. */
const nullable = ValidateIf(
  (_, v) => v !== null && v !== undefined && v !== '',
);
const BD_PHONE = 'phone must be a valid Bangladeshi phone number';

export class CreateAddressDto {
  @IsOptional()
  @trim
  @nullable
  @IsString()
  @MaxLength(40)
  label?: string | null;

  @trim
  @IsString()
  @Length(1, 120)
  fullName: string;

  @trim
  @IsPhoneNumber('BD', { message: BD_PHONE })
  phone: string;

  @trim
  @IsString()
  @Length(3, 300)
  addressLine: string;

  @IsOptional()
  @trim
  @nullable
  @IsString()
  @MaxLength(120)
  area?: string | null;

  @trim
  @IsString()
  @Length(2, 80)
  city: string;

  @IsOptional()
  @trim
  @nullable
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @trim
  @nullable
  @IsString()
  @MaxLength(40)
  label?: string | null;

  @IsOptional()
  @trim
  @IsString()
  @Length(1, 120)
  fullName?: string;

  @IsOptional()
  @trim
  @IsPhoneNumber('BD', { message: BD_PHONE })
  phone?: string;

  @IsOptional()
  @trim
  @IsString()
  @Length(3, 300)
  addressLine?: string;

  @IsOptional()
  @trim
  @nullable
  @IsString()
  @MaxLength(120)
  area?: string | null;

  @IsOptional()
  @trim
  @IsString()
  @Length(2, 80)
  city?: string;

  @IsOptional()
  @trim
  @nullable
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  /** `true` makes it the default. `false` on the default is a 400 (pick another default instead). */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
