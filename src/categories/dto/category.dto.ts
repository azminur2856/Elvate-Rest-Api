import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  isURL,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateBy,
  ValidateIf,
  ValidationOptions,
} from 'class-validator';
import { IMG_PATH_PATTERN } from 'src/common/media';
import { SLUG_PATTERN } from 'src/common/slug';

const SLUG_MESSAGE = 'slug must be lowercase kebab-case (a-z, 0-9, -)';

/** BE-28: a full URL, or the /img/ path the API returned for it. */
function IsImageUrl(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isImageUrl',
      validator: {
        validate: (v: unknown) =>
          typeof v === 'string' &&
          (IMG_PATH_PATTERN.test(v) || isURL(v, { require_protocol: true })),
        defaultMessage: () => 'imageUrl must be a URL or an /img/ path',
      },
    },
    options,
  );
}

export class CreateCategoryDto {
  @IsString()
  @Length(1, 120)
  name: string;

  /** Optional; generated from the name (children: `<parent-slug>-<name>`). */
  @IsOptional()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(140)
  slug?: string;

  /** Omit (or null) for a top-level category. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsImageUrl()
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/** Same fields as create, all optional. `parentId: null` moves it to the top level. */
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(140)
  slug?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsImageUrl()
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
