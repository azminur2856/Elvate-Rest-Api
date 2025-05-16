// src/utils/resize-to-base64.util.ts
import * as sharp from 'sharp';

export async function resizeToBase64(
  imageBuffer: Buffer,
  width = 300,
  height = 300,
  quality = 80,
): Promise<string> {
  const resizedBuffer = await sharp(imageBuffer)
    .resize(width, height, { fit: 'cover' })
    .jpeg({ quality }) // Convert to JPEG with given quality
    .toBuffer();

  return resizedBuffer.toString('base64');
}
