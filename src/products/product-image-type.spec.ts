import { BadRequestException } from '@nestjs/common';
import sharp from 'src/common/sharp';
import { productImageFormat } from './admin-products.service';

// SEC-18: product photos are checked by content, not by MIME type.
describe('productImageFormat', () => {
  const img = (w = 8) =>
    sharp({ create: { width: w, height: w, channels: 3, background: '#0a0' } });
  const file = (buffer: Buffer, originalname = 'pic.png') => ({
    buffer,
    originalname,
  });

  it('accepts real JPG, PNG and WebP pictures', async () => {
    await expect(
      productImageFormat(file(await img().jpeg().toBuffer())),
    ).resolves.toBe('jpeg');
    await expect(
      productImageFormat(file(await img().png().toBuffer())),
    ).resolves.toBe('png');
    await expect(
      productImageFormat(file(await img().webp().toBuffer())),
    ).resolves.toBe('webp');
  });

  it('refuses a non-image named .png', async () => {
    await expect(
      productImageFormat(file(Buffer.from('%PDF-1.4'), 'photo.png')),
    ).rejects.toThrow('photo.png: The file is not a readable image.');
  });

  it('refuses GIF / TIFF with the product message', async () => {
    for (const buf of [
      await img().gif().toBuffer(),
      await img().tiff().toBuffer(),
    ]) {
      await expect(productImageFormat(file(buf, 'x.png'))).rejects.toThrow(
        'x.png: only JPG, PNG or WebP images are allowed',
      );
    }
  });

  it('refuses pixel bombs (over 25 MP)', async () => {
    const bomb = await img(6000).png({ compressionLevel: 9 }).toBuffer();
    await expect(productImageFormat(file(bomb))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
