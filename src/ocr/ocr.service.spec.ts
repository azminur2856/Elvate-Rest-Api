import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import sharp from 'src/common/sharp';
import { OcrService } from './ocr.service';
import { BackgroundRemover } from './background/background-remover';

describe('OcrService.removeBackground (BE-21)', () => {
  const file = {
    buffer: Buffer.alloc(0),
    mimetype: 'image/jpeg',
    originalname: 'a.jpg',
  };
  beforeAll(async () => {
    // a real 1x1 JPEG: the service now checks the content (SEC-03)
    file.buffer = await sharp({
      create: { width: 1, height: 1, channels: 3, background: '#fff' },
    })
      .jpeg()
      .toBuffer();
  });
  const make = (subscribed: boolean, remover: Partial<BackgroundRemover>) =>
    new OcrService(
      { createActivityLog: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue({ id: 'u1' }) } as never,
      {
        getSubscriptionStatus: jest
          .fn()
          .mockResolvedValue({ isSubscribed: subscribed }),
      } as never,
      remover as BackgroundRemover,
    );

  it('403 when the user is not subscribed', async () => {
    await expect(
      make(false, { isConfigured: () => true }).removeBackground(file, 'u1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('503 when no provider key is configured', async () => {
    await expect(
      make(true, { isConfigured: () => false }).removeBackground(file, 'u1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns the PNG as base64', async () => {
    const png = Buffer.from('\x89PNG fake');
    const remove = jest.fn().mockResolvedValue(png);
    await expect(
      make(true, { isConfigured: () => true, remove }).removeBackground(
        file,
        'u1',
      ),
    ).resolves.toEqual({
      contentType: 'image/png',
      data: png.toString('base64'),
    });
    expect(remove).toHaveBeenCalledWith(file.buffer, 'image/jpeg', 'a.jpg');
  });
});
