import { BadRequestException } from '@nestjs/common';
import { AdminOrdersService, ONLY_DELIVERY_MAN } from './admin-orders.service';
import { OrdersService } from './orders.service';
import { OrderStatus, PaymentMethod, PaymentStatus } from './order.enums';
import { CorrectionReason, OrderCorrectionDto } from './dto/admin-order.dto';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { Role } from 'src/users/enums/role.enum';

const admin = { id: 'a1', role: Role.ADMIN };
const staff = { id: 's1', role: Role.STAFF };
const RIDER = {
  id: 'r1',
  email: 'rider@shop.example.org',
  firstName: 'Rafi',
  lastName: 'Rider',
};

const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  orderNumber: 'ELV-261112-TEST',
  userId: 'u1',
  status: OrderStatus.OUT_FOR_DELIVERY,
  paymentMethod: PaymentMethod.COD,
  paymentStatus: PaymentStatus.UNPAID,
  deliveryManId: 'r1',
  stripeSessionId: null,
  total: 700,
  ...over,
});

function adminWith(current: ReturnType<typeof order>) {
  const ordersService = {
    changeStatus: jest.fn().mockResolvedValue(undefined),
    detailFor: jest.fn().mockResolvedValue({ id: current.id }),
  };
  const mailer = { sendCorrection: jest.fn() };
  const service = new AdminOrdersService(
    { findOne: jest.fn().mockResolvedValue(current) } as never,
    {
      getRepository: () => ({
        findOne: jest.fn().mockResolvedValue(RIDER),
      }),
    } as never,
    ordersService as never,
    { createActivityLog: jest.fn() } as never,
    mailer as never,
  );
  return { service, ordersService, mailer };
}

const correction = (
  over: Partial<OrderCorrectionDto> = {},
): OrderCorrectionDto => ({
  action: OrderStatus.DELIVERED,
  reason: CorrectionReason.CUSTOMER_CONFIRMED,
  note: 'Customer called the shop',
  ...over,
});

describe('BE-29: ADMIN / STAFF never perform a delivery', () => {
  it.each([
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.RETURN_REQUESTED,
  ])('PATCH status %s → 400 for admin and staff', async (status) => {
    for (const actor of [admin, staff]) {
      const { service, ordersService } = adminWith(
        order({ status: OrderStatus.SHIPPED }),
      );
      await expect(
        service.updateStatus('o1', { status }, actor),
      ).rejects.toThrow(ONLY_DELIVERY_MAN);
      expect(ordersService.changeStatus).not.toHaveBeenCalled();
    }
  });

  it('"Send out again": RETURN_REQUESTED → SHIPPED is allowed', async () => {
    const { service, ordersService } = adminWith(
      order({ status: OrderStatus.RETURN_REQUESTED }),
    );
    await service.updateStatus('o1', { status: OrderStatus.SHIPPED }, staff);
    expect(ordersService.changeStatus).toHaveBeenCalledWith(
      'o1',
      OrderStatus.SHIPPED,
      null,
      staff,
    );
  });
});

describe('BE-29: admin correction of a stuck delivery', () => {
  it.each([
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.RETURN_REQUESTED,
    OrderStatus.CANCELLED,
  ])('only while OUT_FOR_DELIVERY (not %s)', async (status) => {
    const { service, ordersService } = adminWith(order({ status }));
    await expect(
      service.correct('o1', correction({ cashCollected: true }), admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ordersService.changeStatus).not.toHaveBeenCalled();
  });

  it('COD delivered needs cashCollected', async () => {
    const { service } = adminWith(order());
    await expect(service.correct('o1', correction(), admin)).rejects.toThrow(
      'cashCollected is required',
    );
  });

  it('records the reason label + note, marks it a correction and e-mails the rider', async () => {
    const { service, ordersService, mailer } = adminWith(order());
    await service.correct('o1', correction({ cashCollected: false }), admin);
    expect(ordersService.changeStatus).toHaveBeenCalledWith(
      'o1',
      OrderStatus.DELIVERED,
      'Correction: Customer confirmed — Customer called the shop',
      admin,
      { reason: 'Customer confirmed', cashCollected: false },
    );
    expect(mailer.sendCorrection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'o1' }),
      { email: RIDER.email, name: 'Rafi Rider' },
      {
        action: OrderStatus.DELIVERED,
        reason: 'Customer confirmed',
        note: 'Customer called the shop',
        cashCollected: false,
      },
    );
  });

  it('cashCollected only matters for COD deliveries', async () => {
    const card = adminWith(order({ paymentMethod: PaymentMethod.STRIPE }));
    await card.service.correct('o1', correction(), admin);
    expect(card.ordersService.changeStatus.mock.calls[0][4]).toEqual({
      reason: 'Customer confirmed',
      cashCollected: undefined,
    });

    const ret = adminWith(order());
    await ret.service.correct(
      'o1',
      correction({
        action: OrderStatus.RETURN_REQUESTED,
        reason: CorrectionReason.DELIVERY_MAN_UNAVAILABLE,
        cashCollected: true,
      }),
      admin,
    );
    expect(ret.ordersService.changeStatus.mock.calls[0][4]).toEqual({
      reason: 'Delivery man unavailable',
      cashCollected: undefined,
    });
  });
});

describe('BE-29: OrdersService.changeStatus with a correction', () => {
  function serviceWith(current: ReturnType<typeof order>) {
    const m = {
      findOne: jest.fn().mockResolvedValue({ ...current }),
      find: jest.fn().mockResolvedValue([]),
      increment: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
    };
    const activityLogs = { createActivityLog: jest.fn() };
    const service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      orders: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(current)
          .mockResolvedValue(null),
      },
      dataSource: { transaction: (cb: (em: typeof m) => unknown) => cb(m) },
      coupons: { releaseUsage: jest.fn() },
      activityLogs,
      stripe: null,
    });
    return { service, m, activityLogs };
  }

  it('cash not collected: DELIVERED but still UNPAID, history row flagged', async () => {
    const { service, m, activityLogs } = serviceWith(order());
    await service.changeStatus(
      'o1',
      OrderStatus.DELIVERED,
      'Correction',
      admin,
      {
        reason: 'Customer confirmed',
        cashCollected: false,
      },
    );
    expect(m.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'o1' },
      expect.objectContaining({
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.UNPAID,
      }),
    );
    expect(m.insert).toHaveBeenCalledWith(
      OrderStatusHistory,
      expect.objectContaining({ correction: true, changedById: 'a1' }),
    );
    const log = activityLogs.createActivityLog.mock.calls[0][0] as {
      activity: ActivityType;
      description: string;
    };
    expect(log.activity).toBe(ActivityType.ADMIN_ORDER_CORRECTION);
    expect(log.description).toContain('cash collected: no');
  });

  it('cash collected: the COD order becomes PAID', async () => {
    const { service, m } = serviceWith(order());
    await service.changeStatus(
      'o1',
      OrderStatus.DELIVERED,
      'Correction',
      admin,
      {
        reason: 'Delivery man confirmed by phone',
        cashCollected: true,
      },
    );
    expect(m.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'o1' },
      expect.objectContaining({ paymentStatus: PaymentStatus.PAID }),
    );
  });

  it('a normal step is not a correction', async () => {
    const { service, m, activityLogs } = serviceWith(
      order({ status: OrderStatus.SHIPPED }),
    );
    await service.changeStatus('o1', OrderStatus.OUT_FOR_DELIVERY, null, {
      id: 'r1',
      role: Role.DELIVERY_MAN,
    });
    expect(m.insert).toHaveBeenCalledWith(
      OrderStatusHistory,
      expect.objectContaining({ correction: false }),
    );
    expect(activityLogs.createActivityLog.mock.calls[0][0]).toMatchObject({
      activity: ActivityType.DELIVERY_UPDATE_STATUS,
    });
  });
});
