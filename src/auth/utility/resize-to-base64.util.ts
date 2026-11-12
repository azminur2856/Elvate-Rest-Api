import { BadRequestException } from '@nestjs/common';
import { sharpInput } from 'src/common/image-input';

/** Square JPEG thumbnail for Face++; same 25 MP input limit as the tools. */
export async function resizeToBase64(
  imageBuffer: Buffer,
  width = 300,
  height = 300,
  quality = 80,
): Promise<string> {
  let resizedBuffer: Buffer;
  try {
    resizedBuffer = await sharpInput(imageBuffer)
      .resize(width, height, { fit: 'cover' })
      .jpeg({ quality })
      .toBuffer();
  } catch {
    throw new BadRequestException(
      'The photo could not be read (JPG, PNG or WebP up to 25 megapixels).',
    );
  }
  return resizedBuffer.toString('base64');
}
