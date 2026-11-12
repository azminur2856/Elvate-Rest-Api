import { ForbiddenException } from '@nestjs/common';
import { FACE_LOGIN_TURNED_OFF, SettingsService } from './settings.service';
import { FaceLoginService } from 'src/auth/face-login/face-login.service';
import { FaceReferenceService } from 'src/face/face-reference.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { Role } from 'src/users/enums/role.enum';

const FACE_ENV = ['FACEPP_API_KEY', 'FACEPP_API_SECRET'];
const off = () => {
  throw new ForbiddenException(FACE_LOGIN_TURNED_OFF);
};

// BE-27: the "Face login" admin switch.
describe('face_login switch', () => {
  const saved = Object.fromEntries(FACE_ENV.map((k) => [k, process.env[k]]));
  afterAll(() => FACE_ENV.forEach((k) => (process.env[k] = saved[k])));

  describe('SettingsService', () => {
    const repo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
    const logs = { createActivityLog: jest.fn() };
    let service: SettingsService;

    beforeEach(() => {
      jest.clearAllMocks();
      FACE_ENV.forEach((k) => (process.env[k] = 'set'));
      service = new SettingsService(repo as never, logs as never);
    });

    it('is on by default and reported to the public', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.publicSettings()).resolves.toMatchObject({
        faceLoginEnabled: true,
      });
      await expect(service.assertFaceLoginEnabled()).resolves.toBeUndefined();
    });

    it('switched off: 403 "Face login is turned off"', async () => {
      repo.findOne.mockResolvedValue({ key: 'face_login', enabled: false });
      await expect(service.assertFaceLoginEnabled()).rejects.toThrow(
        new ForbiddenException(FACE_LOGIN_TURNED_OFF),
      );
    });

    it('counts as off without the Face++ keys', async () => {
      delete process.env.FACEPP_API_KEY;
      repo.findOne.mockResolvedValue({ key: 'face_login', enabled: true });
      await expect(service.isEnabled('face_login')).resolves.toBe(false);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('an admin change is logged with old and new value', async () => {
      repo.findOne
        .mockResolvedValueOnce({ key: 'face_login', enabled: true })
        .mockResolvedValueOnce({ key: 'face_login', enabled: false });
      await service.update('face_login', false, { id: 'a1', role: Role.ADMIN });
      expect(logs.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          activity: ActivityType.ADMIN_UPDATE_SETTING,
          description: 'ADMIN a1 turned face_login off (was on).',
        }),
      );
    });
  });

  describe('enforcement', () => {
    const settings = { assertFaceLoginEnabled: jest.fn(off) };
    const challenges = { delete: jest.fn(), save: jest.fn(), query: jest.fn() };
    const attempts = { assertNotLocked: jest.fn() };
    const faceLogin = new FaceLoginService(
      challenges as never,
      {} as never,
      attempts as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      settings as never,
    );
    const refs = { findOne: jest.fn(), delete: jest.fn() };
    const users = { findOne: jest.fn(), update: jest.fn() };
    const references = new FaceReferenceService(
      refs as never,
      users as never,
      {} as never,
      { isConfigured: () => true } as never,
      { createActivityLog: jest.fn() } as never,
      {} as never,
      settings as never,
    );

    beforeEach(() => jest.clearAllMocks());

    it('OFF: no challenge, no face login (even with an old challenge), no setup', async () => {
      await expect(faceLogin.createChallenge('a@b.co')).rejects.toThrow(
        FACE_LOGIN_TURNED_OFF,
      );
      await expect(
        faceLogin.verify({
          email: 'a@b.co',
          challengeId: 'issued-before',
          neutral: Buffer.alloc(0),
          action: Buffer.alloc(0),
          ip: '1.2.3.4',
        }),
      ).rejects.toThrow(FACE_LOGIN_TURNED_OFF);
      await expect(
        references.enroll('u1', Buffer.alloc(0), { password: 'x' }),
      ).rejects.toThrow(FACE_LOGIN_TURNED_OFF);
      expect(challenges.save).not.toHaveBeenCalled();
      expect(attempts.assertNotLocked).not.toHaveBeenCalled();
      expect(users.findOne).not.toHaveBeenCalled();
    });

    it('OFF: Remove still works', async () => {
      refs.findOne.mockResolvedValueOnce(null);
      await expect(references.remove('u1')).resolves.toEqual({
        faceLoginEnabled: false,
      });
      expect(settings.assertFaceLoginEnabled).not.toHaveBeenCalled();
    });
  });
});
