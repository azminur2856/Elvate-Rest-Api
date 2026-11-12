import { Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { OrdersService } from './orders.service';
import { PaymentStatus } from './order.enums';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { ViewDedupe, VIEW_WINDOW_MS } from 'src/products/view-dedupe';

// SEC-23: refunds / disputes made in Stripe, and view counting.
describe('Stripe dashboard events', () => {
  function serviceWith(locked: object | null) {
    const m = {
      findOne: jest.fn().mockResolvedValue(locked && { ...locked }),
      update: jest.fn(),
    };
    const logs = { createActivityLog: jest.fn() };
    const s = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(s, {
      dataSource: { transaction: (cb: (em: typeof m) => unknown) => cb(m) },
      orders: { findOne: jest.fn().mockResolvedValue(locked) },
      activityLogs: logs,
      logger: new Logger('test'),
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    return { s, m, logs };
  }
  const paid = {
    id: 'o1',
    orderNumber: 'ELV-261112-TEST',
    userId: 'u1',
    paymentStatus: PaymentStatus.PAID,
  };
  const event = (type: string, object: object) =>
    ({ type, data: { object } }) as unknown as Stripe.Event;

  it('routes charge events to orders', () => {
    const { s } = serviceWith(null);
    expect(s.isOrderEvent(event('charge.refunded', {}))).toBe(true);
    expect(s.isOrderEvent(event('charge.dispute.created', {}))).toBe(true);
    expect(s.isOrderEvent(event('invoice.paid', {}))).toBe(false);
  });

  it('a full refund in Stripe marks the paid order REFUNDED', async () => {
    const { s, m, logs } = serviceWith(paid);
    await s.handleStripeEvent(
      event('charge.refunded', {
        payment_intent: 'pi_1',
        refunded: true,
        amount_refunded: 103500,
      }),
    );
    expect(m.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'o1' },
      { paymentStatus: PaymentStatus.REFUNDED },
    );
    expect(logs.createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: ActivityType.ORDER_REFUND,
        description: expect.stringContaining(
          'refunded in the Stripe dashboard',
        ) as string,
      }),
    );
  });

  it('a partial refund is only logged', async () => {
    const { s, m, logs } = serviceWith(paid);
    await s.handleStripeEvent(
      event('charge.refunded', {
        payment_intent: 'pi_1',
        refunded: false,
        amount_refunded: 5000,
      }),
    );
    expect(m.update).not.toHaveBeenCalled();
    expect(logs.createActivityLog).toHaveBeenCalled();
  });

  it('an already refunded order (Elvate refunded it) is left alone', async () => {
    const { s, m, logs } = serviceWith({
      ...paid,
      paymentStatus: PaymentStatus.REFUNDED,
    });
    await s.handleStripeEvent(
      event('charge.refunded', { payment_intent: 'pi_1', refunded: true }),
    );
    expect(m.update).not.toHaveBeenCalled();
    expect(logs.createActivityLog).not.toHaveBeenCalled();
  });

  it('a dispute is logged as ORDER_DISPUTE; unknown payments are ignored', async () => {
    const { s, logs } = serviceWith(paid);
    await s.handleStripeEvent(
      event('charge.dispute.created', {
        payment_intent: 'pi_1',
        reason: 'fraudulent',
        amount: 103500,
      }),
    );
    expect(logs.createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ activity: ActivityType.ORDER_DISPUTE }),
    );
    const none = serviceWith(null);
    await none.s.handleStripeEvent(
      event('charge.dispute.created', { payment_intent: 'pi_x' }),
    );
    expect(none.logs.createActivityLog).not.toHaveBeenCalled();
  });
});

describe('ViewDedupe', () => {
  it('counts one view per visitor and product per hour', () => {
    const d = new ViewDedupe();
    const t0 = 1_000_000;
    expect(d.shouldCount('p1', 'ip-a', t0)).toBe(true);
    expect(d.shouldCount('p1', 'ip-a', t0 + 1000)).toBe(false);
    expect(d.shouldCount('p1', 'ip-b', t0 + 1000)).toBe(true); // other visitor
    expect(d.shouldCount('p2', 'ip-a', t0 + 1000)).toBe(true); // other product
    expect(d.shouldCount('p1', 'ip-a', t0 + VIEW_WINDOW_MS + 1)).toBe(true);
  });

  it('never grows past its cap', () => {
    const d = new ViewDedupe();
    for (let i = 0; i < 25_000; i++) d.shouldCount(`p${i}`, 'ip', 0);
    expect(d.size).toBeLessThanOrEqual(20_000);
  });
});
