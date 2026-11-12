import { BadRequestException } from '@nestjs/common';
import sharp from './sharp';
import { MAX_INPUT_PIXELS, openImage, sharpInput } from './image-input';
import { resizeToBase64 } from 'src/auth/utility/resize-to-base64.util';

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#fff' } });

// SEC-03: decide from the file content, and refuse pixel bombs before decoding.
describe('openImage', () => {
  it('reads the real format and size of JPEG, PNG and WebP', async () => {
    for (const [fmt, buf] of [
      ['jpeg', await solid(40, 30).jpeg().toBuffer()],
      ['png', await solid(40, 30).png().toBuffer()],
      ['webp', await solid(40, 30).webp().toBuffer()],
    ] as const) {
      const opened = await openImage(buf);
      expect(opened).toMatchObject({ format: fmt, width: 40, height: 30 });
    }
  });

  it('refuses a non-image whatever it is called', async () => {
    await expect(openImage(Buffer.from('%PDF-1.4\n'))).rejects.toThrow(
      'The file is not a readable image.',
    );
  });

  it('refuses formats outside JPG/PNG/WebP/HEIC (e.g. GIF, TIFF)', async () => {
    for (const buf of [
      await solid(4, 4).gif().toBuffer(),
      await solid(4, 4).tiff().toBuffer(),
    ]) {
      await expect(openImage(buf)).rejects.toThrow(
        'Only JPG, PNG, WebP or HEIC images are allowed.',
      );
    }
  });

  it('refuses a small file that would decode to over 25 megapixels', async () => {
    const bomb = await solid(6000, 6000)
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(bomb.length).toBeLessThan(1024 * 1024); // tiny on disk, 36 MP inside
    await expect(openImage(bomb)).rejects.toBeInstanceOf(BadRequestException);
    await expect(openImage(bomb)).rejects.toThrow('at most 25 megapixels');
  });

  it('pipelines keep the same pixel limit', async () => {
    const bomb = await solid(6000, 6000)
      .png({ compressionLevel: 9 })
      .toBuffer();
    await expect(sharpInput(bomb).jpeg().toBuffer()).rejects.toThrow(
      /pixel limit/i,
    );
    expect(MAX_INPUT_PIXELS).toBe(25_000_000);
  });
});

describe('resizeToBase64 (face photos)', () => {
  it('returns a 300x300 JPEG', async () => {
    const out = await resizeToBase64(await solid(640, 480).png().toBuffer());
    const meta = await sharp(Buffer.from(out, 'base64')).metadata();
    expect(meta).toMatchObject({ format: 'jpeg', width: 300, height: 300 });
  });

  it('answers 400 for an unreadable photo instead of crashing', async () => {
    await expect(resizeToBase64(Buffer.from('nope'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
