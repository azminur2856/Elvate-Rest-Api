import { BadGatewayException, ConflictException, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { OrdersService, paidAmountMatches } from './orders.service';
import { OrderStatus, PaymentMethod, PaymentStatus } from './order.enums';
import { Role } from 'src/users/enums/role.enum';

// SEC-10: payment races and wrong / duplicate payments.
const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  orderNumber: 'ELV-261112-TEST',
  userId: 'u1',
  status: OrderStatus.PENDING,
  paymentMethod: PaymentMethod.STRIPE,
  paymentStatus: PaymentStatus.UNPAID,
  stripeSessionId: 'cs_old',
  stripePaymentIntentId: null as string | null,
  total: 1035,
  ...over,
});

function serviceWith(pre: object, locked: object) {
  const m = {
    findOne: jest.fn().mockResolvedValue({ ...locked }),
    find: jest.fn().mockResolvedValue([]),
    increment: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
  };
  const stripe = {
    refunds: { create: jest.fn().mockResolvedValue({ id: 're_1' }) },
    checkout: {
      sessions: {
        retrieve: jest.fn(),
        create: jest.fn(),
        expire: jest.fn(),
      },
    },
  };
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, {
    orders: {
      findOne: jest.fn().mockResolvedValue({ ...pre }),
      update: jest.fn(),
    },
    dataSource: { transaction: (cb: (em: typeof m) => unknown) => cb(m) },
    coupons: { releaseUsage: jest.fn() },
    activityLogs: { createActivityLog: jest.fn() },
    mailer: { send: jest.fn() },
    logger: new Logger('test'),
    stripe,
  });
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service, m, stripe };
}

const completed = (over: Partial<Stripe.Checkout.Session> = {}) =>
  ({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_new',
        payment_status: 'paid',
        payment_intent: 'pi_new',
        amount_total: 103500,
        currency: 'bdt',
        metadata: { kind: 'order', orderId: 'o1' },
        ...over,
      },
    },
  }) as unknown as Stripe.Event;

describe('paidAmountMatches', () => {
  it('needs BDT and the order total (1 paisa rounding allowed)', () => {
    const o = { total: 1035 };
    expect(
      paidAmountMatches({ amount_total: 103500, currency: 'bdt' }, o),
    ).toBe(true);
    expect(
      paidAmountMatches({ amount_total: 103501, currency: 'BDT' }, o),
    ).toBe(true);
    expect(paidAmountMatches({ amount_total: 100, currency: 'bdt' }, o)).toBe(
      false,
    );
    expect(
      paidAmountMatches({ amount_total: 103500, currency: 'usd' }, o),
    ).toBe(false);
    expect(paidAmountMatches({ amount_total: null, currency: 'bdt' }, o)).toBe(
      false,
    );
  });
});

describe('changeStatus refund decided under the row lock', () => {
  const staff = { id: 's1', role: Role.STAFF };

  it('a payment that landed after the first read is refunded', async () => {
    const { service, m, stripe } = serviceWith(
      order({ status: OrderStatus.CONFIRMED }), // read before the lock: unpaid
      order({
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        stripePaymentIntentId: 'pi_paid',
      }),
    );
    await service.changeStatus('o1', OrderStatus.CANCELLED, null, staff);
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_paid' }),
      expect.anything(),
    );
    expect(m.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'o1' },
      expect.objectContaining({
        status: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.REFUNDED,
      }),
    );
  });

  it('a failed refund changes nothing', async () => {
    const paid = order({
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      stripePaymentIntentId: 'pi_paid',
    });
    const { service, m, stripe } = serviceWith(paid, paid);
    stripe.refunds.create.mockRejectedValueOnce(new Error('stripe down'));
    await expect(
      service.changeStatus('o1', OrderStatus.CANCELLED, null, staff),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(m.update).not.toHaveBeenCalled();
  });
});

describe('markPaid (Stripe webhook)', () => {
  it('marks a matching payment paid and confirms the order', async () => {
    const { service, m, stripe } = serviceWith(order(), order());
    await service.handleStripeEvent(completed());
    expect(m.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'o1' },
      expect.objectContaining({ paymentStatus: PaymentStatus.PAID }),
    );
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it('a wrong amount or currency is not marked paid but refunded', async () => {
    const { service, m, stripe } = serviceWith(order(), order());
    await service.handleStripeEvent(completed({ amount_total: 100 }));
    expect(m.update).not.toHaveBeenCalled();
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_new' }),
      { idempotencyKey: 'refund-pi-pi_new' },
    );
  });

  it('a second, different payment for a paid order is refunded', async () => {
    const paid = order({
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      stripePaymentIntentId: 'pi_first',
    });
    const { service, m, stripe } = serviceWith(paid, paid);
    await service.handleStripeEvent(completed());
    expect(m.update).not.toHaveBeenCalled();
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_new' }),
      { idempotencyKey: 'refund-pi-pi_new' },
    );
  });

  it('a replay of the same payment is ignored (idempotent)', async () => {
    const paid = order({
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      stripePaymentIntentId: 'pi_new',
    });
    const { service, stripe } = serviceWith(paid, paid);
    await service.handleStripeEvent(completed());
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
});

describe('pay()', () => {
  const buyer = { id: 'u1', role: Role.BUYER };

  it('409 when the previous checkout was already paid', async () => {
    const { service, stripe } = serviceWith(order(), order());
    stripe.checkout.sessions.retrieve.mockResolvedValueOnce({
      status: 'complete',
    });
    await expect(service.pay(buyer, 'o1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
