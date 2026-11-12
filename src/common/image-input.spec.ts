import { BadRequestException } from '@nestjs/common';
import sharp from './sharp';
import { MAX_INPUT_PIXELS, openImage, sharpInput } from './image-input';
import { faceJpeg } from 'src/face/face-photo';
import { FaceCheckFailure } from 'src/users/services/face-check';

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

describe('faceJpeg (face photos for Face++)', () => {
  it('returns a JPEG of at most 640 px, keeping the aspect ratio', async () => {
    const out = await faceJpeg(await solid(1280, 960).png().toBuffer());
    const meta = await sharp(out).metadata();
    expect(meta).toMatchObject({ format: 'jpeg', width: 640, height: 480 });
  });

  it('does not enlarge small photos', async () => {
    const meta = await sharp(
      await faceJpeg(await solid(320, 240).png().toBuffer()),
    ).metadata();
    expect(meta).toMatchObject({ width: 320, height: 240 });
  });

  it('turns an unreadable photo into BAD_IMAGE instead of crashing', async () => {
    await expect(faceJpeg(Buffer.from('nope'))).rejects.toMatchObject({
      reason: 'BAD_IMAGE',
    });
    await expect(faceJpeg(Buffer.from('nope'))).rejects.toBeInstanceOf(
      FaceCheckFailure,
    );
  });
});
