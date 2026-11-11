import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { SubscriptionService } from './subscription.service';
import { Subscription } from './entities/subscription.entity';
import { Payment } from './entities/payment.entity';
import { UsersService } from '../users/users.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import stripeConfig from './config/stripe.config';

const ts = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

const event = (type: string, object: unknown) =>
  ({ id: 'evt_1', type, data: { object } }) as unknown as Stripe.Event;

describe('SubscriptionService webhooks', () => {
  let service: SubscriptionService;
  const saved: { entity: string; data: Record<string, unknown> }[] = [];

  const txManager = {
    create: (entity: { name: string }, data: Record<string, unknown>) => ({
      __entity: entity.name,
      ...data,
    }),
    save: jest.fn((row: Record<string, unknown>) => {
      const { __entity, ...data } = row;
      saved.push({ entity: __entity as string, data });
      return Promise.resolve({ id: `${__entity as string}-id`, ...data });
    }),
  };
  const subRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn((rows: unknown) => Promise.resolve(rows)),
    manager: {
      transaction: jest.fn((cb: (m: typeof txManager) => unknown) =>
        cb(txManager),
      ),
    },
  };
  const payRepo = { exists: jest.fn() };
  const usersService = { findOne: jest.fn() };
  const activityLogs = { createActivityLog: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    saved.length = 0;
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: getRepositoryToken(Subscription), useValue: subRepo },
        { provide: getRepositoryToken(Payment), useValue: payRepo },
        { provide: UsersService, useValue: usersService },
        { provide: ActivityLogsService, useValue: activityLogs },
        {
          provide: stripeConfig.KEY,
          useValue: { stripeSecretKey: 'sk_test_unit', price1m: 'price_1m' },
        },
      ],
    }).compile();
    service = moduleRef.get(SubscriptionService);
  });

  it('acknowledges non-subscription checkout sessions (order payments) without touching the DB', async () => {
    await service.handleWebhook(
      event('checkout.session.completed', {
        mode: 'payment',
        metadata: { kind: 'order', orderId: 'o1' },
      }),
    );
    expect(payRepo.exists).not.toHaveBeenCalled();
    expect(subRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it('ignores event types it does not handle', async () => {
    await expect(
      service.handleWebhook(event('customer.created', {})),
    ).resolves.toBeUndefined();
  });

  it('rejects a subscription session without metadata', async () => {
    await expect(
      service.handleWebhook(
        event('checkout.session.completed', {
          mode: 'subscription',
          metadata: {},
        }),
      ),
    ).rejects.toThrow('Missing or invalid metadata');
  });

  it('skips a retried checkout whose invoice is already recorded', async () => {
    payRepo.exists.mockResolvedValue(true);
    await service.handleWebhook(
      event('checkout.session.completed', {
        mode: 'subscription',
        invoice: 'in_1',
        metadata: { userId: 'u1', plan: '1m' },
      }),
    );
    expect(usersService.findOne).not.toHaveBeenCalled();
    expect(subRepo.manager.transaction).not.toHaveBeenCalled();
  });

  describe('invoice.paid', () => {
    const renewal = {
      id: 'in_renew',
      billing_reason: 'subscription_cycle',
      amount_paid: 10000,
      currency: 'bdt',
      hosted_invoice_url: 'https://invoice.example/in_renew',
      parent: { subscription_details: { subscription: 'sub_1' } },
      lines: {
        data: [
          {
            period: {
              start: ts('2026-10-29T00:00:00Z'),
              end: ts('2026-11-29T00:00:00Z'),
            },
          },
        ],
      },
    };

    it('records a renewal as a new period + linked payment', async () => {
      payRepo.exists.mockResolvedValue(false);
      subRepo.findOne.mockResolvedValue({
        id: 'old',
        plan: '1m',
        endDate: new Date('2026-10-29T00:00:00Z'),
        user: { id: 'u1' },
      });

      await service.handleWebhook(event('invoice.paid', renewal));

      const sub = saved.find((s) => s.entity === 'Subscription')!.data;
      const pay = saved.find((s) => s.entity === 'Payment')!.data;
      expect(sub).toMatchObject({
        plan: '1m',
        stripeSubscriptionId: 'sub_1',
        user: { id: 'u1' },
        startDate: new Date('2026-10-29T00:00:00Z'),
        endDate: new Date('2026-11-29T00:00:00Z'),
      });
      expect(pay).toMatchObject({
        amount: 100,
        currency: 'bdt',
        stripeInvoiceId: 'in_renew',
        subscription: { id: 'Subscription-id' },
      });
      expect(activityLogs.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ activity: ActivityType.SUBSCRIPTION_RENEW }),
      );
    });

    it('is idempotent: an already-recorded invoice is skipped', async () => {
      payRepo.exists.mockResolvedValue(true);
      await service.handleWebhook(event('invoice.paid', renewal));
      expect(subRepo.findOne).not.toHaveBeenCalled();
      expect(saved).toHaveLength(0);
    });

    it('treats a concurrent duplicate (unique violation) as already recorded', async () => {
      payRepo.exists.mockResolvedValue(false);
      subRepo.findOne.mockResolvedValue({
        plan: '1m',
        endDate: new Date(),
        user: { id: 'u1' },
      });
      subRepo.manager.transaction.mockImplementationOnce(() =>
        Promise.reject(Object.assign(new Error('dup'), { code: '23505' })),
      );
      await service.handleWebhook(event('invoice.paid', renewal));
      expect(activityLogs.createActivityLog).not.toHaveBeenCalled();
    });

    it('ignores the first invoice (recorded by checkout.session.completed)', async () => {
      await service.handleWebhook(
        event('invoice.paid', {
          ...renewal,
          billing_reason: 'subscription_create',
        }),
      );
      expect(payRepo.exists).not.toHaveBeenCalled();
    });

    it('ignores renewals of subscriptions it does not know', async () => {
      payRepo.exists.mockResolvedValue(false);
      subRepo.findOne.mockResolvedValue(null);
      await service.handleWebhook(event('invoice.paid', renewal));
      expect(subRepo.manager.transaction).not.toHaveBeenCalled();
    });
  });

  describe('customer.subscription.deleted', () => {
    const endedAt = ts('2026-11-11T12:00:00Z');

    it('cancels every period and cuts access at ended_at', async () => {
      const current = {
        isCancelled: false,
        endDate: new Date('2026-11-29T00:00:00Z'),
        user: { id: 'u1' },
      };
      const past = {
        isCancelled: false,
        endDate: new Date('2026-10-29T00:00:00Z'),
        user: { id: 'u1' },
      };
      subRepo.find.mockResolvedValue([current, past]);

      await service.handleWebhook(
        event('customer.subscription.deleted', {
          id: 'sub_1',
          ended_at: endedAt,
        }),
      );

      expect(current).toMatchObject({
        isCancelled: true,
        endDate: new Date(endedAt * 1000),
      });
      expect(past).toMatchObject({
        isCancelled: true,
        endDate: new Date('2026-10-29T00:00:00Z'),
      });
      expect(activityLogs.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ activity: ActivityType.SUBSCRIPTION_ENDED }),
      );
    });

    it('is idempotent: already-cancelled periods are left alone', async () => {
      subRepo.find.mockResolvedValue([
        {
          isCancelled: true,
          endDate: new Date(endedAt * 1000),
          user: { id: 'u1' },
        },
      ]);
      await service.handleWebhook(
        event('customer.subscription.deleted', {
          id: 'sub_1',
          ended_at: endedAt,
        }),
      );
      expect(subRepo.save).not.toHaveBeenCalled();
      expect(activityLogs.createActivityLog).not.toHaveBeenCalled();
    });
  });
});
