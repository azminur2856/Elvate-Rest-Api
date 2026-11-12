import { BadRequestException } from '@nestjs/common';
import sharp from 'src/common/sharp';
import { imagekit } from 'src/auth/utility/imagekit';
import { FaceReferenceService } from './face-reference.service';
import { FaceCheckFailure } from 'src/users/services/face-check';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import * as bcrypt from 'bcrypt';

// SEC-04: face setup stores a private photo and never uses the avatar.
describe('FaceReferenceService', () => {
  const refs = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const users = { findOne: jest.fn(), update: jest.fn(), query: jest.fn() };
  const sessions = { findOne: jest.fn() };
  const face = {
    isConfigured: jest.fn(() => true),
    analyze: jest.fn(),
    compare: jest.fn(),
  };
  const activityLogs = { createActivityLog: jest.fn() };
  const mail = { sendNotificationEmail: jest.fn() };
  const service = new FaceReferenceService(
    refs as never,
    users as never,
    sessions as never,
    face as never,
    activityLogs as never,
    mail as never,
  );
  const upload = jest.spyOn(imagekit, 'upload') as unknown as jest.Mock;
  const deleteFile = jest.spyOn(imagekit, 'deleteFile') as unknown as jest.Mock;
  const url = jest.spyOn(imagekit, 'url') as unknown as jest.Mock;
  let photo: Buffer;
  let passwordHash: string;
  /** BE-26: the right password for the mocked account */
  const AUTH = { password: 'Right#123', sessionId: 's1' };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(AUTH.password, 4);
    photo = await sharp({
      create: { width: 1280, height: 960, channels: 3, background: '#ccc' },
    })
      .jpeg()
      .toBuffer();
  });
  afterAll(() => jest.restoreAllMocks());

  beforeEach(() => {
    jest.clearAllMocks();
    users.findOne.mockResolvedValue({
      id: 'u1',
      email: 'b@e.test',
      firstName: '<b>Bo</b>',
      lastName: null,
      profileImage: 'me.jpg',
      password: passwordHash,
    });
    face.compare.mockResolvedValue({
      confidence: 90,
      thresholds: { '1e-5': 74 },
    });
    url.mockReturnValue('https://ik/signed');
    face.analyze.mockResolvedValue({
      faceToken: 't',
      yaw: 3,
      eyesOpen: 96,
      eyesClosed: 1,
    });
    upload.mockResolvedValue({
      fileId: 'new-file',
      filePath: '/face_reference/user_u1/face-1.jpg',
    });
    deleteFile.mockResolvedValue(undefined);
  });

  it('enroll: private upload of a 640 px JPEG, flag on, old file deleted', async () => {
    refs.findOne.mockResolvedValueOnce({ userId: 'u1', fileId: 'old-file' });
    await expect(service.enroll('u1', photo, AUTH)).resolves.toEqual({
      faceLoginEnabled: true,
    });
    const args = upload.mock.calls[0][0] as {
      file: Buffer;
      folder: string;
      isPrivateFile: boolean;
    };
    expect(args).toMatchObject({
      folder: '/face_reference/user_u1/',
      isPrivateFile: true,
    });
    const meta = await sharp(args.file).metadata();
    expect(meta).toMatchObject({ format: 'jpeg', width: 640, height: 480 });
    expect(refs.save).toHaveBeenCalledWith({
      userId: 'u1',
      fileId: 'new-file',
      filePath: '/face_reference/user_u1/face-1.jpg',
    });
    expect(users.update).toHaveBeenCalledWith('u1', { isFaceVerified: true });
    expect(deleteFile).toHaveBeenCalledWith('old-file');
    // the raw name goes to MailService, which escapes it (SEC-15)
    expect(mail.sendNotificationEmail.mock.calls[0][1]).toBe('<b>Bo</b>');
  });

  it.each([
    [
      'no face',
      () => face.analyze.mockRejectedValue(new FaceCheckFailure('NO_FACE')),
    ],
    [
      'head turned',
      () =>
        face.analyze.mockResolvedValue({
          faceToken: 't',
          yaw: 35,
          eyesOpen: 96,
          eyesClosed: 1,
        }),
    ],
    [
      'eyes closed',
      () =>
        face.analyze.mockResolvedValue({
          faceToken: 't',
          yaw: 0,
          eyesOpen: 10,
          eyesClosed: 85,
        }),
    ],
  ])(
    'enroll refuses a photo with %s (400, nothing stored)',
    async (_l, arrange) => {
      arrange();
      await expect(service.enroll('u1', photo, AUTH)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(upload).not.toHaveBeenCalled();
      expect(users.update).not.toHaveBeenCalled();
    },
  );

  it('enroll refuses a file that is not an image', async () => {
    await expect(
      service.enroll('u1', Buffer.from('not an image'), AUTH),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(face.analyze).not.toHaveBeenCalled();
  });

  it('remove: deletes the row and the file, turns face login off', async () => {
    refs.findOne.mockResolvedValueOnce({ userId: 'u1', fileId: 'f1' });
    await expect(service.remove('u1')).resolves.toEqual({
      faceLoginEnabled: false,
    });
    expect(refs.delete).toHaveBeenCalledWith({ userId: 'u1' });
    expect(deleteFile).toHaveBeenCalledWith('f1');
    expect(users.update).toHaveBeenCalledWith('u1', { isFaceVerified: false });
    expect(activityLogs.createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ activity: ActivityType.USER_REMOVE_FACE }),
    );
  });

  it('signedReferenceUrl: a short-lived signed URL, or null', async () => {
    url.mockReturnValueOnce('https://ik/signed');
    refs.findOne.mockResolvedValueOnce({ filePath: '/face_reference/x.jpg' });
    await expect(service.signedReferenceUrl('u1')).resolves.toBe(
      'https://ik/signed',
    );
    expect(url).toHaveBeenCalledWith({
      path: '/face_reference/x.jpg',
      signed: true,
      expireSeconds: 120,
    });
    refs.findOne.mockResolvedValueOnce(null);
    await expect(service.signedReferenceUrl('u2')).resolves.toBeNull();
  });
});
