import { ConflictException, Logger } from '@nestjs/common';
import {
  CARD_PENDING_MAX_MS,
  COD_PENDING_MAX_MS,
  MAX_UNPAID_PENDING,
  OrdersService,
  sameCart,
} from './orders.service';
import { OrderStatus, PaymentMethod, PaymentStatus } from './order.enums';
import { Role } from 'src/users/enums/role.enum';

// SEC-11: stock hoarding and double submits.
describe('sameCart', () => {
  it('compares variant + quantity in any order', () => {
    const a = [
      { variantId: 'v1', quantity: 2 },
      { variantId: 'v2', quantity: 1 },
    ];
    expect(sameCart(a, [...a].reverse())).toBe(true);
    expect(sameCart(a, [{ variantId: 'v1', quantity: 2 }])).toBe(false);
    expect(
      sameCart(a, [
        { variantId: 'v1', quantity: 3 },
        { variantId: 'v2', quantity: 1 },
      ]),
    ).toBe(false);
  });
});

describe('OrdersService: unpaid cap and stale orders', () => {
  function service(over: Record<string, unknown> = {}) {
    const s = Object.create(OrdersService.prototype) as OrdersService;
    const orders = { find: jest.fn().mockResolvedValue([]), count: jest.fn() };
    const cart = { entriesOf: jest.fn().mockResolvedValue([]) };
    Object.assign(s, {
      orders,
      cart,
      logger: new Logger('test'),
      ...over,
    });
    return { s, orders, cart };
  }
  const buyer = { id: 'u1', role: Role.BUYER };

  it(`refuses a new order with ${MAX_UNPAID_PENDING} unpaid ones waiting`, async () => {
    const { s, orders, cart } = service();
    orders.count.mockResolvedValueOnce(MAX_UNPAID_PENDING);
    await expect(
      s.place(buyer, { addressId: 'a1', paymentMethod: PaymentMethod.COD }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(orders.count).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
      },
    });
    expect(cart.entriesOf).not.toHaveBeenCalled();
  });

  it('below the cap it goes on to the cart', async () => {
    const { s, orders, cart } = service();
    orders.count.mockResolvedValueOnce(MAX_UNPAID_PENDING - 1);
    await expect(
      s.place(buyer, { addressId: 'a1', paymentMethod: PaymentMethod.COD }),
    ).rejects.toThrow('Your cart is empty');
    expect(cart.entriesOf).toHaveBeenCalled();
  });

  it('cancels stale COD (48 h) and dead card (2 h) orders through changeStatus', async () => {
    const { s, orders } = service();
    orders.find.mockResolvedValueOnce([
      { id: 'cod', paymentMethod: PaymentMethod.COD },
      { id: 'card', paymentMethod: PaymentMethod.STRIPE },
    ]);
    const change = jest.spyOn(s, 'changeStatus').mockResolvedValue({} as never);
    const before = Date.now();
    await expect(s.cancelStaleOrders('u1')).resolves.toBe(2);

    const where = (
      orders.find.mock.calls[0][0] as {
        where: { paymentMethod: PaymentMethod; placedAt: { value: Date } }[];
      }
    ).where;
    const cod = where.find((w) => w.paymentMethod === PaymentMethod.COD)!;
    const card = where.find((w) => w.paymentMethod === PaymentMethod.STRIPE)!;
    expect(before - cod.placedAt.value.getTime()).toBeGreaterThanOrEqual(
      COD_PENDING_MAX_MS - 1000,
    );
    expect(before - card.placedAt.value.getTime()).toBeGreaterThanOrEqual(
      CARD_PENDING_MAX_MS - 1000,
    );
    expect(change).toHaveBeenCalledWith(
      'cod',
      OrderStatus.CANCELLED,
      'Not confirmed within 48 hours',
      null,
    );
    expect(change).toHaveBeenCalledWith(
      'card',
      OrderStatus.CANCELLED,
      'Card payment was not completed',
      null,
    );
  });

  it('one failing cancel does not stop the sweep', async () => {
    const { s, orders } = service();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    orders.find.mockResolvedValueOnce([
      { id: 'a', paymentMethod: PaymentMethod.COD },
      { id: 'b', paymentMethod: PaymentMethod.COD },
    ]);
    const change = jest
      .spyOn(s, 'changeStatus')
      .mockRejectedValueOnce(new Error('changed meanwhile'))
      .mockResolvedValueOnce({} as never);
    await s.cancelStaleOrders();
    expect(change).toHaveBeenCalledTimes(2);
  });
});
