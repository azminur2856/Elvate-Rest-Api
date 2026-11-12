import {
  BadRequestException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import sharp from 'src/common/sharp';
import { FACE_LOGIN_FAILED, FaceLoginService } from './face-login.service';
import { FACE_ACTIONS, FaceCheckFailure } from 'src/users/services/face-check';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';

const STRICT = { '1e-4': 69, '1e-5': 74 };
const user = {
  id: 'u1',
  email: 'buyer@elvate.test',
  firstName: 'Test',
  lastName: 'Buyer',
  isActive: true,
  isFaceVerified: true,
};

// SEC-04: the decision chain of POST /auth/login-with-face.
describe('FaceLoginService', () => {
  const challenges = {
    delete: jest.fn(),
    create: jest.fn((v: object) => v),
    save: jest.fn((v: object) => Promise.resolve({ id: 'c1', ...v })),
    query: jest.fn(),
  };
  const users = { findOne: jest.fn() };
  const attempts = {
    assertNotLocked: jest.fn(),
    recordFailure: jest.fn(),
    clear: jest.fn(),
  };
  const face = { analyze: jest.fn(), compare: jest.fn() };
  const references = { signedReferenceUrl: jest.fn() };
  const activityLogs = { createActivityLog: jest.fn() };
  const mail = { sendNotificationEmail: jest.fn() };
  const service = new FaceLoginService(
    challenges as never,
    users as never,
    attempts as never,
    face as never,
    references as never,
    activityLogs as never,
    mail as never,
  );
  let photo: Buffer;
  const input = () => ({
    email: user.email,
    challengeId: 'c1',
    neutral: photo,
    action: photo,
    ip: '1.2.3.4',
  });

  beforeAll(async () => {
    photo = await sharp({
      create: { width: 64, height: 64, channels: 3, background: '#ccc' },
    })
      .jpeg()
      .toBuffer();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    attempts.assertNotLocked.mockResolvedValue(undefined);
    challenges.query.mockResolvedValue([[{ action: 'BLINK' }], 1]);
    users.findOne.mockResolvedValue(user);
    references.signedReferenceUrl.mockResolvedValue('https://signed/ref.jpg');
    face.analyze
      .mockResolvedValueOnce({
        faceToken: 'n',
        yaw: 2,
        eyesOpen: 95,
        eyesClosed: 1,
      })
      .mockResolvedValueOnce({
        faceToken: 'a',
        yaw: 3,
        eyesOpen: 5,
        eyesClosed: 92,
      });
    face.compare.mockResolvedValue({ confidence: 90, thresholds: STRICT });
  });

  const expectGenericFailure = async () => {
    await expect(service.verify(input())).rejects.toThrow(
      new UnauthorizedException(FACE_LOGIN_FAILED),
    );
    expect(attempts.recordFailure).toHaveBeenCalledWith([
      { scope: 'face-email', key: user.email },
      { scope: 'face-ip', key: '1.2.3.4' },
    ]);
  };

  it('createChallenge: a random prompt, same shape for any e-mail', async () => {
    const c = await service.createChallenge('Nobody@Example.com');
    expect(FACE_ACTIONS).toContain(c.action);
    expect(c).toMatchObject({ challengeId: 'c1', prompt: expect.any(String) });
    expect(challenges.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'nobody@example.com' }),
    );
  });

  it('signs in when every check passes and clears the e-mail counter', async () => {
    await expect(service.verify(input())).resolves.toBe(user);
    expect(face.compare).toHaveBeenLastCalledWith(
      { imageUrl: 'https://signed/ref.jpg' },
      { faceToken: 'n' },
    );
    expect(attempts.clear).toHaveBeenCalledWith([
      { scope: 'face-email', key: user.email },
    ]);
    expect(attempts.recordFailure).not.toHaveBeenCalled();
  });

  it('a locked e-mail or IP stops before anything else', async () => {
    attempts.assertNotLocked.mockRejectedValueOnce(new HttpException('x', 429));
    await expect(service.verify(input())).rejects.toBeInstanceOf(HttpException);
    expect(challenges.query).not.toHaveBeenCalled();
    expect(face.analyze).not.toHaveBeenCalled();
  });

  it('an expired, used or foreign challenge is a 400', async () => {
    challenges.query.mockResolvedValueOnce([[], 0]);
    await expect(service.verify(input())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([
    ['unknown e-mail', () => users.findOne.mockResolvedValue(null)],
    [
      'blocked user',
      () => users.findOne.mockResolvedValue({ ...user, isActive: false }),
    ],
    [
      'face login not set up',
      () => users.findOne.mockResolvedValue({ ...user, isFaceVerified: false }),
    ],
    [
      'no private reference',
      () => references.signedReferenceUrl.mockResolvedValue(null),
    ],
  ])('%s: generic 401, counted, no Face++ call', async (_l, arrange) => {
    arrange();
    await expectGenericFailure();
    expect(face.analyze).not.toHaveBeenCalled();
  });

  it('a photo without a usable face: generic 401 and a failure log', async () => {
    face.analyze.mockReset();
    face.analyze.mockRejectedValueOnce(new FaceCheckFailure('MANY_FACES'));
    await expectGenericFailure();
    expect(activityLogs.createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: ActivityType.USER_LOGIN_FACE_FAILED,
        description: expect.stringContaining('MANY_FACES') as string,
      }),
    );
  });

  it('the prompt was not done (still photo): generic 401', async () => {
    face.analyze.mockReset();
    const still = { faceToken: 'n', yaw: 2, eyesOpen: 95, eyesClosed: 1 };
    face.analyze.mockResolvedValue(still);
    await expectGenericFailure();
    expect(face.compare).not.toHaveBeenCalled();
  });

  it('the two frames show different people: generic 401', async () => {
    face.compare.mockResolvedValueOnce({ confidence: 40, thresholds: STRICT });
    await expectGenericFailure();
  });

  it('no strict match with the private reference: generic 401', async () => {
    face.compare
      .mockResolvedValueOnce({ confidence: 90, thresholds: STRICT })
      .mockResolvedValueOnce({ confidence: 72, thresholds: STRICT }); // < 1e-5
    await expectGenericFailure();
  });

  it('notifySignIn escapes the browser string in the e-mail', () => {
    service.notifySignIn(user as never, '<script>x</script>');
    const body = mail.sendNotificationEmail.mock.calls[0][3] as string;
    expect(body).toContain('&lt;script&gt;');
    expect(body).not.toContain('<script>');
  });
});
