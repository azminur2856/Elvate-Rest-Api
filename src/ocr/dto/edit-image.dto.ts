import { BadRequestException } from '@nestjs/common';
import { Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
  ValidationError,
  validateSync,
} from 'class-validator';

/** Longest edge any crop / resize may ask for (SEC-03). */
export const MAX_EDGE = 4096;
export const ROTATIONS = [-270, -180, -90, 0, 90, 180, 270];

export class CropDto {
  @IsInt()
  @Min(0)
  @Max(MAX_EDGE - 1)
  left: number;

  @IsInt()
  @Min(0)
  @Max(MAX_EDGE - 1)
  top: number;

  @IsInt()
  @Min(1)
  @Max(MAX_EDGE)
  width: number;

  @IsInt()
  @Min(1)
  @Max(MAX_EDGE)
  height: number;
}

export class SizeDto {
  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(MAX_EDGE)
  width: number;

  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(MAX_EDGE)
  height: number;
}

/** The `options` JSON of POST /ocr/image/edit. Unknown keys are rejected. */
export class EditOptionsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CropDto)
  crop?: CropDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SizeDto)
  resize?: SizeDto;

  @IsOptional()
  @IsIn(ROTATIONS, {
    message: 'rotate must be a multiple of 90 between -270 and 270',
  })
  rotate?: number;

  /** 1 = unchanged. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  brightness?: number;

  /** 1 = unchanged. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  contrast?: number;

  @IsOptional()
  @IsBoolean()
  grayscale?: boolean;

  @IsOptional()
  @IsBoolean()
  flip?: boolean;

  @IsOptional()
  @IsBoolean()
  flop?: boolean;

  /** Gaussian sigma; values below 0.3 mean "no blur". */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  blur?: number;
}

function messages(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((e) => {
    const path = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((m) =>
      parent ? `${parent}.${m}` : m,
    );
    return [...own, ...messages(e.children ?? [], path)];
  });
}

/** Parses + validates the multipart `options` field; 400 on any problem. */
export function parseEditOptions(raw: unknown): EditOptionsDto {
  let plain: unknown = raw;
  if (typeof raw === 'string') {
    try {
      plain = JSON.parse(raw);
    } catch {
      plain = undefined;
    }
  }
  if (!plain || typeof plain !== 'object' || Array.isArray(plain)) {
    throw new BadRequestException('options must be a JSON object');
  }
  const dto = plainToInstance(EditOptionsDto, plain);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length) throw new BadRequestException(messages(errors));
  return dto;
}
