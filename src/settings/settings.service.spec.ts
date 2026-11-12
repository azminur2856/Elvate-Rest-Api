import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  SETTINGS_CACHE_MS,
  SMS_TURNED_OFF,
  SettingsService,
} from './settings.service';
import { SettingsController } from './settings.controller';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Role } from 'src/users/enums/role.enum';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';

const SMS_ENV = ['SMS_API_URL', 'SMS_API_KEY', 'SMS_SENDER_ID'];
const admin = { id: 'a1', role: Role.ADMIN };

// BE-25: admin feature switches.
describe('SettingsService', () => {
  const saved = Object.fromEntries(SMS_ENV.map((k) => [k, process.env[k]]));
  const repo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
  const logs = { createActivityLog: jest.fn() };
  let service: SettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    SMS_ENV.forEach((k) => (process.env[k] = 'set'));
    service = new SettingsService(repo as never, logs as never);
  });
  afterAll(() => {
    jest.useRealTimers();
    SMS_ENV.forEach((k) => (process.env[k] = saved[k]));
  });

  it('a missing row counts as the default: SMS is OFF', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.isEnabled('sms_otp')).resolves.toBe(false);
    await expect(service.assertSmsEnabled()).rejects.toThrow(
      new ForbiddenException(SMS_TURNED_OFF),
    );
  });

  it('caches a value for 30 s, then reads it again', async () => {
    jest.useFakeTimers();
    repo.findOne.mockResolvedValue({ key: 'sms_otp', enabled: true });
    await service.isEnabled('sms_otp');
    await service.isEnabled('sms_otp');
    expect(repo.findOne).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(SETTINGS_CACHE_MS + 1);
    await service.isEnabled('sms_otp');
    expect(repo.findOne).toHaveBeenCalledTimes(2);
  });

  it('an admin change takes effect at once (cache cleared)', async () => {
    repo.findOne.mockResolvedValueOnce({ key: 'sms_otp', enabled: false });
    await expect(service.isEnabled('sms_otp')).resolves.toBe(false);
    repo.findOne
      .mockResolvedValueOnce({ key: 'sms_otp', enabled: false }) // "before"
      .mockResolvedValueOnce({ key: 'sms_otp', enabled: true }) // reply row
      .mockResolvedValueOnce({ key: 'sms_otp', enabled: true }); // next read
    const view = await service.update('sms_otp', true, admin);
    expect(view).toMatchObject({
      key: 'sms_otp',
      enabled: true,
      available: true,
    });
    expect(repo.save).toHaveBeenCalledWith({
      key: 'sms_otp',
      enabled: true,
      updatedById: 'a1',
    });
    await expect(service.isEnabled('sms_otp')).resolves.toBe(true);
    await expect(service.assertSmsEnabled()).resolves.toBeUndefined();
    expect(logs.createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: ActivityType.ADMIN_UPDATE_SETTING,
        description: 'ADMIN a1 turned sms_otp on (was off).',
      }),
    );
  });

  it('cannot turn on SMS without the SMS credentials (409); off is fine', async () => {
    delete process.env.SMS_API_KEY;
    await expect(service.update('sms_otp', true, admin)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
    repo.findOne.mockResolvedValue({ key: 'sms_otp', enabled: false });
    await expect(
      service.update('sms_otp', false, admin),
    ).resolves.toMatchObject({
      enabled: false,
      available: false,
    });
  });

  it('an unknown switch is a 404', async () => {
    await expect(service.update('nope', true, admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('list() shows every switch with who changed it last', async () => {
    repo.find.mockResolvedValueOnce([
      {
        key: 'sms_otp',
        enabled: true,
        updatedAt: new Date('2026-11-12T00:00:00Z'),
        updatedBy: { firstName: 'Test', lastName: 'Admin' },
      },
    ]);
    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({
        key: 'sms_otp',
        enabled: true,
        label: 'SMS verification (OTP)',
        updatedBy: { name: 'Test Admin' },
        available: true,
      }),
      // BE-27: no row yet -> its default (on), never changed by anyone
      expect.objectContaining({
        key: 'face_login',
        enabled: true,
        label: 'Face login',
        updatedBy: null,
      }),
    ]);
  });
});

describe('SettingsController roles', () => {
  const guard = new RolesGuard(new Reflector());
  const ctx = (
    handler: (...args: never[]) => unknown,
    role?: Role,
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => SettingsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { id: 'x', role } : undefined }),
      }),
    }) as unknown as ExecutionContext;
  // the route handlers the guard sees (read without binding them)
  const handler = (name: keyof SettingsController) =>
    Object.getOwnPropertyDescriptor(SettingsController.prototype, name)!
      .value as (...args: never[]) => unknown;

  it.each([Role.STAFF, Role.BUYER, Role.DELIVERY_MAN])(
    '%s gets 403 on both admin routes',
    (role) => {
      expect(guard.canActivate(ctx(handler('list'), role))).toBe(false);
      expect(guard.canActivate(ctx(handler('update'), role))).toBe(false);
    },
  );

  it('ADMIN may use them; the public route has no role', () => {
    expect(guard.canActivate(ctx(handler('list'), Role.ADMIN))).toBe(true);
    expect(guard.canActivate(ctx(handler('update'), Role.ADMIN))).toBe(true);
    expect(guard.canActivate(ctx(handler('publicSettings')))).toBe(true);
  });
});
