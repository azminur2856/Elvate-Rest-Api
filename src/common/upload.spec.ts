import {
  BadRequestException,
  Controller,
  INestApplication,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import {
  FACE_PHOTO_UPLOAD,
  MB,
  NO_FACE_PHOTO,
  SingleFileUpload,
  UPLOAD_LIMITS,
} from './upload';

@Controller()
class UploadTestController {
  @Post('any')
  @UseInterceptors(SingleFileUpload('file'))
  any(@UploadedFile() file?: Express.Multer.File) {
    return { size: file?.size ?? null };
  }

  @Post('small')
  @UseInterceptors(SingleFileUpload('file', { maxBytes: 1024 }))
  small(@UploadedFile() file?: Express.Multer.File) {
    return { size: file?.size ?? null };
  }

  @Post('face')
  @UseInterceptors(SingleFileUpload('liveImage', FACE_PHOTO_UPLOAD))
  face(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException(NO_FACE_PHOTO);
    return { size: file.size };
  }
}

// SEC-02: every upload is held in memory, so each route needs hard limits.
describe('SingleFileUpload', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UploadTestController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  it('accepts a file under the limit', async () => {
    const res = await request(server())
      .post('/any')
      .attach('file', Buffer.alloc(2048), 'a.pdf')
      .expect(201);
    expect(res.body).toEqual({ size: 2048 });
  });

  it('answers 413 above 10 MB', async () => {
    await request(server())
      .post('/any')
      .attach('file', Buffer.alloc(UPLOAD_LIMITS.fileSize + 1), 'big.pdf')
      .expect(413);
  });

  it('honours a smaller per-route limit', async () => {
    await request(server())
      .post('/small')
      .attach('file', Buffer.alloc(1025), 'a.pdf')
      .expect(413);
  });

  it('never raises the limit above 10 MB', () => {
    expect(UPLOAD_LIMITS.fileSize).toBe(10 * MB);
  });

  it('answers 400 for a second file or an unknown field', async () => {
    await request(server())
      .post('/any')
      .attach('file', Buffer.alloc(10), 'a.pdf')
      .attach('file', Buffer.alloc(10), 'b.pdf')
      .expect(400);
    await request(server())
      .post('/any')
      .attach('other', Buffer.alloc(10), 'a.pdf')
      .expect(400);
  });

  it('face photos: only JPG, PNG or WebP', async () => {
    const res = await request(server())
      .post('/face')
      .attach('liveImage', Buffer.alloc(10), {
        filename: 'a.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect((res.body as { message: string }).message).toBe(
      FACE_PHOTO_UPLOAD.typeError,
    );
    await request(server())
      .post('/face')
      .attach('liveImage', Buffer.alloc(10), {
        filename: 'a.png',
        contentType: 'image/png',
      })
      .expect(201);
  });

  it('face photos: a missing photo is a 400, not a crash', async () => {
    const res = await request(server())
      .post('/face')
      .field('email', 'a@b.c')
      .expect(400);
    expect((res.body as { message: string }).message).toBe(NO_FACE_PHOTO);
  });
});
