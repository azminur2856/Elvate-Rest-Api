import { OrdersService } from './orders.service';
import { PaymentMethod } from './order.enums';
import { Role } from 'src/users/enums/role.enum';

/** BE-30: the delivery fees come from the settings table (via its service). */
describe('OrdersService delivery fees', () => {
  const line = {
    id: 'c1',
    variantId: 'v1',
    productId: 'p1',
    name: 'Tee',
    slug: 'tee',
    size: 'M',
    color: null,
    image: null,
    unitPrice: 1000,
    quantity: 2,
    lineTotal: 2000,
    available: true,
  };
  const buyer = { id: 'u1', role: Role.BUYER };

  function service(rules: Record<string, number>, city = 'Dhaka') {
    const calls: string[] = [];
    const s = Object.create(OrdersService.prototype) as OrdersService;
    const m = {
      find: jest.fn().mockResolvedValue([{ variantId: 'v1', quantity: 2 }]),
      query: jest.fn().mockResolvedValue([[], 1]), // stock decremented
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((_e: unknown, v: object) => v),
      save: jest.fn((v: object) => Promise.resolve({ id: 'o1', ...v })),
      insert: jest.fn(),
      delete: jest.fn(),
    };
    Object.assign(s, {
      shipping: {
        rules: jest.fn(() => {
          calls.push('rules');
          return Promise.resolve(rules);
        }),
      },
      cart: {
        entriesOf: jest
          .fn()
          .mockResolvedValue([{ id: 'c1', variantId: 'v1', quantity: 2 }]),
        priceLines: jest.fn().mockResolvedValue([line]),
      },
      addresses: {
        findDefault: jest.fn().mockResolvedValue({ city }),
        findOwn: jest.fn().mockResolvedValue({ city }),
        snapshot: jest.fn(() => ({ city, isInsideDhaka: city === 'Dhaka' })),
      },
      orders: { count: jest.fn().mockResolvedValue(0) },
      dataSource: {
        getRepository: () => ({
          find: jest.fn().mockResolvedValue([{ id: 'v1', sku: 'S1' }]),
        }),
        transaction: (cb: (em: typeof m) => unknown) => {
          calls.push('transaction');
          return cb(m);
        },
      },
      activityLogs: { createActivityLog: jest.fn() },
      logger: { warn: jest.fn(), error: jest.fn() },
    });
    jest.spyOn(s, 'cancelStaleOrders').mockResolvedValue(0);
    jest.spyOn(s, 'detailFor').mockResolvedValue({} as never);
    jest
      .spyOn(s as unknown as { notify: () => Promise<void> }, 'notify')
      .mockResolvedValue(undefined);
    return { s, m, calls };
  }
  const savedOrder = (m: { save: jest.Mock }) =>
    m.save.mock.calls[0][0] as { shippingFee: number; total: number };

  it('the quote uses the fees from the table', async () => {
    const { s } = service({
      insideDhaka: 80,
      outsideDhaka: 150,
      freeThreshold: 2500,
    });
    await expect(s.quote('u1', {})).resolves.toMatchObject({
      subtotal: 2000,
      shippingFee: 80,
      total: 2080,
      freeShippingThreshold: 2500,
    });
    const outside = service(
      { insideDhaka: 80, outsideDhaka: 150, freeThreshold: 2500 },
      'Chattogram',
    );
    await expect(outside.s.quote('u1', {})).resolves.toMatchObject({
      shippingFee: 150,
    });
  });

  it('threshold reached -> free; threshold 0 -> never free and null', async () => {
    const free = service({
      insideDhaka: 80,
      outsideDhaka: 150,
      freeThreshold: 2000,
    });
    await expect(free.s.quote('u1', {})).resolves.toMatchObject({
      shippingFee: 0,
      freeShippingThreshold: 2000,
    });
    const off = service({
      insideDhaka: 80,
      outsideDhaka: 150,
      freeThreshold: 0,
    });
    await expect(off.s.quote('u1', {})).resolves.toMatchObject({
      shippingFee: 80,
      freeShippingThreshold: null,
    });
  });

  it('a new order saves the fee from the table, read before the transaction', async () => {
    const { s, m, calls } = service({
      insideDhaka: 75,
      outsideDhaka: 150,
      freeThreshold: 0,
    });
    await s.place(buyer, { addressId: 'a1', paymentMethod: PaymentMethod.COD });
    expect(calls).toEqual(['rules', 'transaction']);
    expect(savedOrder(m)).toMatchObject({ shippingFee: 75, total: 2075 });
  });
});
