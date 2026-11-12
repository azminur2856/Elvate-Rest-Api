import { OrdersService } from './orders.service';
import { OrderStatus, PaymentMethod, PaymentStatus } from './order.enums';
import { Role } from 'src/users/enums/role.enum';

/**
 * Frontend report (FSEC-10 test): a request failed with 500 after the order
 * was already saved. Logging and e-mail run after the save and must never
 * turn a successful change into an error.
 */
describe('side effects after a saved order change', () => {
  const current = {
    id: 'o1',
    orderNumber: 'ELV-261112-TEST',
    userId: 'u1',
    status: OrderStatus.OUT_FOR_DELIVERY,
    paymentMethod: PaymentMethod.COD,
    paymentStatus: PaymentStatus.UNPAID,
    deliveryManId: 'r1',
    stripeSessionId: null,
    total: 700,
  };

  function service() {
    const m = {
      findOne: jest.fn().mockResolvedValue({ ...current }),
      find: jest.fn().mockResolvedValue([]),
      increment: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
    };
    const s = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(s, {
      logger: { warn: jest.fn() },
      orders: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(current)
          // the e-mail step reloads the order: the database fails now
          .mockRejectedValue(new Error('connection reset')),
      },
      dataSource: { transaction: (cb: (em: typeof m) => unknown) => cb(m) },
      coupons: { releaseUsage: jest.fn() },
      activityLogs: {
        createActivityLog: jest.fn().mockRejectedValue(new Error('log down')),
      },
      stripe: null,
    });
    return { s, m };
  }

  it('the status change still succeeds and the failures are only logged', async () => {
    const { s, m } = service();
    await expect(
      s.changeStatus('o1', OrderStatus.DELIVERED, null, {
        id: 'r1',
        role: Role.DELIVERY_MAN,
      }),
    ).resolves.toMatchObject({ status: OrderStatus.DELIVERED });
    expect(m.update).toHaveBeenCalled();
    const warn = (s as unknown as { logger: { warn: jest.Mock } }).logger.warn;
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Activity log DELIVERY_UPDATE_STATUS failed'),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Order e-mail (delivered) for o1 failed'),
    );
  });
});
