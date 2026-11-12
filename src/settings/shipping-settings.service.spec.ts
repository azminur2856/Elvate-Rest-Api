import { BadRequestException, Logger } from '@nestjs/common';
import {
  ShippingSettingsService,
  describeShippingChange,
} from './shipping-settings.service';
import { SETTINGS_CACHE_MS } from './settings.service';
import { FEE_LIMIT_MESSAGE } from './shipping-rules';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { Role } from 'src/users/enums/role.enum';

const ENV = [
  'SHIPPING_FEE_INSIDE_DHAKA',
  'SHIPPING_FEE_OUTSIDE_DHAKA',
  'FREE_SHIPPING_THRESHOLD',
];
const admin = { id: 'a1', role: Role.ADMIN };
const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  insideDhaka: 60,
  outsideDhaka: 120,
  freeThreshold: 3000,
  updatedById: null,
  updatedAt: new Date('2026-11-12T10:00:00Z'),
  ...over,
});

// BE-30: delivery fees from the database.
describe('ShippingSettingsService', () => {
  const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  const insert = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const repo = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    insert: jest.fn(),
    createQueryBuilder: jest.fn(() => insert),
  };
  const logs = { createActivityLog: jest.fn() };
  let service: ShippingSettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    ENV.forEach((k) => delete process.env[k]);
    repo.update.mockResolvedValue({ affected: 1 });
    service = new ShippingSettingsService(repo as never, logs as never);
  });
  afterAll(() => {
    jest.useRealTimers();
    ENV.forEach((k) =>
      saved[k] === undefined
        ? delete process.env[k]
        : (process.env[k] = saved[k]),
    );
  });

  it('first start: creates the row from env, else 60 / 120 / 3000', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    process.env.SHIPPING_FEE_INSIDE_DHAKA = '70';
    await service.ensureRow();
    expect(insert.values).toHaveBeenCalledWith({
      id: 1,
      insideDhaka: 70,
      outsideDhaka: 120,
      freeThreshold: 3000,
    });
    expect(insert.orIgnore).toHaveBeenCalled();
  });

  it('never overwrites an existing row', async () => {
    repo.findOne.mockResolvedValueOnce(row({ insideDhaka: 80 }));
    process.env.SHIPPING_FEE_INSIDE_DHAKA = '70';
    await service.ensureRow();
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('caches the rules for 30 s', async () => {
    jest.useFakeTimers();
    repo.findOne.mockResolvedValue(row());
    await expect(service.rules()).resolves.toEqual({
      insideDhaka: 60,
      outsideDhaka: 120,
      freeThreshold: 3000,
    });
    await service.rules();
    expect(repo.findOne).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(SETTINGS_CACHE_MS + 1);
    await service.rules();
    expect(repo.findOne).toHaveBeenCalledTimes(2);
  });

  it('without a row the rules are the first-start defaults', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.rules()).resolves.toEqual({
      insideDhaka: 60,
      outsideDhaka: 120,
      freeThreshold: 3000,
    });
  });

  it('an admin change clears the cache, so the next quote uses it', async () => {
    repo.findOne.mockResolvedValueOnce(row());
    await expect(service.rules()).resolves.toMatchObject({ insideDhaka: 60 });

    const next = { insideDhaka: 80, outsideDhaka: 120, freeThreshold: 2500 };
    repo.findOne
      .mockResolvedValueOnce(row()) // "before"
      .mockResolvedValueOnce(
        row({
          ...next,
          updatedById: 'a1',
          updatedBy: { firstName: 'Demo', lastName: 'Admin' },
        }),
      ) // the reply
      .mockResolvedValueOnce(row(next)); // next rules() read
    await expect(service.update(next, admin)).resolves.toEqual({
      ...next,
      updatedAt: new Date('2026-11-12T10:00:00Z'),
      updatedBy: { name: 'Demo Admin' },
    });
    expect(repo.update).toHaveBeenCalledWith(
      { id: 1 },
      { ...next, updatedById: 'a1' },
    );
    expect(repo.insert).not.toHaveBeenCalled();
    await expect(service.rules()).resolves.toEqual(next);
    expect(logs.createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: ActivityType.ADMIN_UPDATE_SHIPPING,
        description:
          'ADMIN a1 changed delivery fees: inside Dhaka 60 → 80, outside Dhaka 120 → 120, free from 3000 → 2500.',
      }),
    );
  });

  it('saves only the three numbers (no extra fields reach the row)', async () => {
    repo.findOne.mockResolvedValue(row());
    await service.update(
      { insideDhaka: 60, outsideDhaka: 120, freeThreshold: 0, id: 9 } as never,
      admin,
    );
    expect(repo.update).toHaveBeenCalledWith(
      { id: 1 },
      {
        insideDhaka: 60,
        outsideDhaka: 120,
        freeThreshold: 0,
        updatedById: 'a1',
      },
    );
  });

  it('creates the row when it is missing', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.update.mockResolvedValueOnce({ affected: 0 });
    const next = { insideDhaka: 70, outsideDhaka: 130, freeThreshold: 0 };
    await service.update(next, admin);
    expect(repo.insert).toHaveBeenCalledWith({
      id: 1,
      ...next,
      updatedById: 'a1',
    });
  });

  it('refuses numbers outside the limits (400) and saves nothing', async () => {
    await expect(
      service.update(
        { insideDhaka: 5001, outsideDhaka: 120, freeThreshold: 0 },
        admin,
      ),
    ).rejects.toThrow(new BadRequestException(FEE_LIMIT_MESSAGE));
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('a failing activity log does not undo or fail the change', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    repo.findOne.mockResolvedValue(row());
    logs.createActivityLog.mockRejectedValueOnce(new Error('log down'));
    await expect(
      service.update(
        { insideDhaka: 60, outsideDhaka: 120, freeThreshold: 3000 },
        admin,
      ),
    ).resolves.toMatchObject({ insideDhaka: 60 });
    expect(repo.update).toHaveBeenCalled();
  });

  it('view(): no admin change yet -> updatedBy null', async () => {
    repo.findOne.mockResolvedValueOnce(row({ updatedBy: null }));
    await expect(service.view()).resolves.toEqual({
      insideDhaka: 60,
      outsideDhaka: 120,
      freeThreshold: 3000,
      updatedAt: new Date('2026-11-12T10:00:00Z'),
      updatedBy: null,
    });
  });
});

describe('describeShippingChange', () => {
  it('writes 0 as "off"', () => {
    expect(
      describeShippingChange(
        { insideDhaka: 60, outsideDhaka: 120, freeThreshold: 0 },
        { insideDhaka: 60, outsideDhaka: 100, freeThreshold: 3000 },
      ),
    ).toBe(
      'inside Dhaka 60 → 60, outside Dhaka 120 → 100, free from off → 3000',
    );
    expect(
      describeShippingChange(
        { insideDhaka: 60, outsideDhaka: 120, freeThreshold: 3000 },
        { insideDhaka: 60, outsideDhaka: 120, freeThreshold: 0 },
      ),
    ).toContain('free from 3000 → off');
  });
});
