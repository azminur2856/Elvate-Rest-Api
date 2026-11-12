import { BadRequestException } from '@nestjs/common';
import sharp = require('sharp');

/**
 * SEC-03: user images are decoded in memory on a 512 MB box. Refuse anything
 * above 25 megapixels before it is decoded, and give libvips one thread so
 * parallel requests queue instead of multiplying memory.
 */
export const MAX_INPUT_PIXELS = 25_000_000;
export const ALLOWED_IMAGE_FORMATS = ['jpeg', 'png', 'webp', 'heif'] as const;
export type AllowedImageFormat = (typeof ALLOWED_IMAGE_FORMATS)[number];

sharp.concurrency(1);

export interface OpenedImage {
  image: sharp.Sharp;
  width: number;
  height: number;
  format: AllowedImageFormat;
}

/** Same pixel limit for every sharp pipeline that reads user input. */
export function sharpInput(buffer: Buffer): sharp.Sharp {
  return sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS });
}

/**
 * Reads only the header: the real format (not the file name or MIME type the
 * client claims) and the size. 400 for anything that is not a JPG, PNG, WebP
 * or HEIC image, or is larger than `MAX_INPUT_PIXELS`.
 */
export async function openImage(buffer: Buffer): Promise<OpenedImage> {
  let meta: sharp.Metadata;
  try {
    // header only (no decoding), so no pixel limit here: we report size below
    meta = await sharp(buffer, { limitInputPixels: false }).metadata();
  } catch {
    throw new BadRequestException('The file is not a readable image.');
  }
  const format = meta.format as AllowedImageFormat | undefined;
  if (!format || !ALLOWED_IMAGE_FORMATS.includes(format)) {
    throw new BadRequestException(
      'Only JPG, PNG, WebP or HEIC images are allowed.',
    );
  }
  const { width, height } = meta;
  if (!width || !height || width * height > MAX_INPUT_PIXELS) {
    throw new BadRequestException(
      `The image is too large (at most ${MAX_INPUT_PIXELS / 1_000_000} megapixels).`,
    );
  }
  return { image: sharpInput(buffer), width, height, format };
}
