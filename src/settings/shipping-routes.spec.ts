import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import * as request from 'supertest';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ShippingSettingsService } from './shipping-settings.service';
import {
  FEE_LIMIT_MESSAGE,
  FREE_THRESHOLD_LIMIT_MESSAGE,
} from './shipping-rules';
import { RolesGuard } from 'src/auth/guards/roles/roles.guard';
import { Role } from 'src/users/enums/role.enum';

// BE-30: the delivery fee routes over real HTTP (route order, roles, body).
describe('BE-30 /admin/settings/shipping', () => {
  const rules = { insideDhaka: 60, outsideDhaka: 120, freeThreshold: 3000 };
  const settings = {
    publicSettings: jest
      .fn()
      .mockResolvedValue({ smsOtpEnabled: false, faceLoginEnabled: true }),
    list: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ key: 'sms_otp', enabled: true }),
  };
  const shipping = {
    rules: jest.fn().mockResolvedValue(rules),
    view: jest
      .fn()
      .mockResolvedValue({ ...rules, updatedAt: null, updatedBy: null }),
    update: jest.fn(
      (body: typeof rules) =>
        Promise.resolve({ ...body, updatedAt: null, updatedBy: null }) as never,
    ),
  };
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: SettingsService, useValue: settings },
        { provide: ShippingSettingsService, useValue: shipping },
        {
          provide: APP_GUARD,
          useFactory: (r: Reflector) => new RolesGuard(r),
          inject: [Reflector],
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    // stands in for the JWT guard: the role comes from a test header
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const role = req.headers['x-role'];
      if (typeof role === 'string') {
        (req as unknown as { user: object }).user = { id: 'a1', role };
      }
      next();
    });
    // the same global pipe as main.ts
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];
  const patch = (body: unknown, role = Role.ADMIN, path = 'shipping') =>
    request(server())
      .patch(`/admin/settings/${path}`)
      .set('x-role', role)
      .send(body as object);

  it('PATCH shipping reaches the delivery fees, never the switch route', async () => {
    const body = { insideDhaka: 80, outsideDhaka: 150, freeThreshold: 0 };
    const res = await patch(body).expect(200);
    expect(res.body).toMatchObject(body);
    expect(shipping.update).toHaveBeenCalledWith(body, {
      id: 'a1',
      role: Role.ADMIN,
    });
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('the switch route still works for real keys', async () => {
    await patch({ enabled: true }, Role.ADMIN, 'sms_otp').expect(200);
    expect(settings.update).toHaveBeenCalledWith('sms_otp', true, {
      id: 'a1',
      role: Role.ADMIN,
    });
    expect(shipping.update).not.toHaveBeenCalled();
  });

  it('GET shipping answers the admin view', async () => {
    const res = await request(server())
      .get('/admin/settings/shipping')
      .set('x-role', Role.ADMIN)
      .expect(200);
    expect(res.body).toEqual({ ...rules, updatedAt: null, updatedBy: null });
  });

  it.each([Role.STAFF, Role.BUYER, Role.DELIVERY_MAN])(
    '%s gets 403 on both shipping routes',
    async (role) => {
      await request(server())
        .get('/admin/settings/shipping')
        .set('x-role', role)
        .expect(403);
      await patch(rules, role).expect(403);
      expect(shipping.view).not.toHaveBeenCalled();
      expect(shipping.update).not.toHaveBeenCalled();
    },
  );

  const fee = (v: unknown) => ({ ...rules, insideDhaka: v });
  const outside = (v: unknown) => ({ ...rules, outsideDhaka: v });
  const free = (v: unknown) => ({ ...rules, freeThreshold: v });

  it.each([
    ['fee 0', fee(0)],
    ['fee 5000', fee(5000)],
    ['outside 0', outside(0)],
    ['outside 5000', outside(5000)],
    ['free delivery off (0)', free(0)],
    ['free from 100', free(100)],
    ['free from 100000', free(100000)],
  ])('accepts %s', async (_name, body) => {
    await patch(body).expect(200);
    expect(shipping.update).toHaveBeenCalledWith(body, expect.anything());
  });

  it.each([
    ['a negative fee', fee(-1), FEE_LIMIT_MESSAGE],
    ['a fee above 5000', fee(5001), FEE_LIMIT_MESSAGE],
    ['a decimal fee', fee(60.5), FEE_LIMIT_MESSAGE],
    ['a fee as text', fee('60'), FEE_LIMIT_MESSAGE],
    ['a null fee', fee(null), FEE_LIMIT_MESSAGE],
    ['outside above 5000', outside(5001), FEE_LIMIT_MESSAGE],
    ['outside as text', outside('120'), FEE_LIMIT_MESSAGE],
    ['free from 99', free(99), FREE_THRESHOLD_LIMIT_MESSAGE],
    ['free from 100001', free(100001), FREE_THRESHOLD_LIMIT_MESSAGE],
    ['a negative threshold', free(-100), FREE_THRESHOLD_LIMIT_MESSAGE],
    ['a decimal threshold', free(2500.5), FREE_THRESHOLD_LIMIT_MESSAGE],
    ['a threshold as text', free('3000'), FREE_THRESHOLD_LIMIT_MESSAGE],
  ])('refuses %s (400, exact message)', async (_name, body, message) => {
    const res = await patch(body).expect(400);
    expect(res.body.message).toEqual([message]);
    expect(shipping.update).not.toHaveBeenCalled();
  });

  it('refuses missing fields, each message once', async () => {
    const res = await patch({}).expect(400);
    expect(res.body.message).toEqual([
      FEE_LIMIT_MESSAGE,
      FREE_THRESHOLD_LIMIT_MESSAGE,
    ]);
    const one = await patch({ insideDhaka: 60, outsideDhaka: 120 }).expect(400);
    expect(one.body.message).toEqual([FREE_THRESHOLD_LIMIT_MESSAGE]);
  });

  it('refuses unknown fields (400, not silently dropped)', async () => {
    const res = await patch({ ...rules, insideDhakaFee: 10 }).expect(400);
    expect(res.body.message).toEqual([
      'property insideDhakaFee should not exist',
    ]);
    expect(shipping.update).not.toHaveBeenCalled();
  });

  it('GET /settings/public keeps its fields and adds shipping', async () => {
    const res = await request(server()).get('/settings/public').expect(200);
    expect(res.body).toEqual({
      smsOtpEnabled: false,
      faceLoginEnabled: true,
      shipping: { insideDhaka: 60, outsideDhaka: 120, freeThreshold: 3000 },
    });
  });
});
