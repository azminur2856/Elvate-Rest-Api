import { EntityManager } from 'typeorm';
import { decrementStock, OrdersService } from './orders.service';
import { OrderStatus, PaymentMethod, PaymentStatus } from './order.enums';
import { ProductVariant } from 'src/products/entities/product-variant.entity';
import { Product } from 'src/products/entities/product.entity';
import { Role } from 'src/users/enums/role.enum';

describe('decrementStock (checkout)', () => {
  it('only decrements when enough stock is left on an active product', async () => {
    const query = jest.fn().mockResolvedValue([[], 1]);
    await expect(
      decrementStock({ query } as unknown as EntityManager, 'v1', 3),
    ).resolves.toBe(true);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/SET stock = v\.stock - \$1/);
    expect(sql).toMatch(/v\.stock >= \$1/);
    expect(sql).toMatch(/"isActive" = true/);
    expect(params).toEqual([3, 'v1']);
  });

  it('reports a conflict when no row qualified', async () => {
    const query = jest.fn().mockResolvedValue([[], 0]);
    await expect(
      decrementStock({ query } as unknown as EntityManager, 'v1', 9),
    ).resolves.toBe(false);
  });
});

describe('OrdersService.changeStatus: restock / COD payment', () => {
  const order = (over: Record<string, unknown> = {}) => ({
    id: 'o1',
    orderNumber: 'ELV-261111-TEST',
    userId: 'u1',
    status: OrderStatus.CONFIRMED,
    paymentMethod: PaymentMethod.COD,
    paymentStatus: PaymentStatus.UNPAID,
    stripeSessionId: null,
    total: 1060,
    ...over,
  });
  const items = [
    { variantId: 'v1', productId: 'p1', quantity: 2 },
    { variantId: null, productId: null, quantity: 1 }, // variant deleted since
  ];

  function serviceWith(current: ReturnType<typeof order>) {
    const m = {
      findOne: jest.fn().mockResolvedValue({ ...current }),
      find: jest.fn().mockResolvedValue(items),
      increment: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
    };
    const coupons = { releaseUsage: jest.fn() };
    // a bare instance with only the collaborators changeStatus touches
    const service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      orders: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(current)
          .mockResolvedValue(null),
      },
      dataSource: { transaction: (cb: (em: typeof m) => unknown) => cb(m) },
      coupons,
      activityLogs: { createActivityLog: jest.fn() },
      stripe: null,
    });
    return { service, m, coupons };
  }

  const staff = { id: 's1', role: Role.STAFF };

  it('CANCELLED puts the stock back and releases the coupon', async () => {
    const { service, m, coupons } = serviceWith(order());
    await service.changeStatus('o1', OrderStatus.CANCELLED, 'test', staff);
    expect(m.increment).toHaveBeenCalledWith(
      ProductVariant,
      { id: 'v1' },
      'stock',
      2,
    );
    expect(m.increment).toHaveBeenCalledTimes(1); // the deleted variant is skipped
    expect(coupons.releaseUsage).toHaveBeenCalledWith(m, 'o1');
  });

  it('DELIVERED marks a COD order paid and counts the sale', async () => {
    const { service, m, coupons } = serviceWith(
      order({ status: OrderStatus.OUT_FOR_DELIVERY }),
    );
    await service.changeStatus('o1', OrderStatus.DELIVERED, null, staff);
    expect(m.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'o1' },
      expect.objectContaining({
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
      }),
    );
    expect(m.increment).toHaveBeenCalledWith(
      Product,
      { id: 'p1' },
      'soldCount',
      2,
    );
    expect(coupons.releaseUsage).not.toHaveBeenCalled();
  });

  it('refuses a move the rules do not allow', async () => {
    const { service } = serviceWith(order({ status: OrderStatus.DELIVERED }));
    await expect(
      service.changeStatus('o1', OrderStatus.CANCELLED, null, staff),
    ).rejects.toThrow('cannot become CANCELLED');
  });
});
