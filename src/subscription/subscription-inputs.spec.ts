import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CancelSubscriptionDto,
  CreateCheckoutDto,
} from './dto/subscription.dto';
import { SubscriptionService } from './subscription.service';
import { PaginationQueryDto, pageParams } from 'src/common/pagination';

// SEC-14: subscription inputs.
describe('subscription DTOs', () => {
  const errors = async (cls: new () => object, plain: object) =>
    (await validate(plainToInstance(cls, plain))).length;

  it('plan must be 1m, 6m or 12m', async () => {
    for (const plan of ['1m', '6m', '12m']) {
      expect(await errors(CreateCheckoutDto, { plan })).toBe(0);
    }
    for (const plan of ['__proto__', 'toString', '24m', '', undefined]) {
      expect(await errors(CreateCheckoutDto, { plan })).toBe(1);
    }
  });

  it('subscriptionId must be a UUID', async () => {
    expect(
      await errors(CancelSubscriptionDto, {
        subscriptionId: '3f2b6c1e-9a7d-4e2b-8c1a-5d6e7f8a9b0c',
      }),
    ).toBe(0);
    expect(
      await errors(CancelSubscriptionDto, { subscriptionId: "1' OR 1=1" }),
    ).toBe(1);
  });

  it('admin page sizes are capped at 100', () => {
    const q = plainToInstance(PaginationQueryDto, { pageSize: '100000' });
    expect(pageParams(q).pageSize).toBe(100);
  });
});

describe('SubscriptionService.createCheckoutSession', () => {
  const service = Object.create(
    SubscriptionService.prototype,
  ) as SubscriptionService;
  const create = jest.fn();
  Object.assign(service, {
    stripeSettings: { price1m: 'p1', price6m: 'p6', price12m: 'p12' },
    stripe: { checkout: { sessions: { create } } },
  });

  it('refuses a second subscription while one is active', async () => {
    jest.spyOn(service, 'getSubscriptionStatus').mockResolvedValueOnce({
      isSubscribed: true,
      daysLeft: 30,
      startDate: new Date('2026-11-11'),
      endDate: new Date('2026-12-11T17:27:46Z'),
    } as never);
    await expect(service.createCheckoutSession('u1', '1m')).rejects.toThrow(
      new ConflictException(
        'You already have an active subscription until 2026-12-11.',
      ),
    );
    expect(create).not.toHaveBeenCalled();
  });
});
