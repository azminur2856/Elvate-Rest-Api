import { allowedNextStatuses, canPay, canTransition } from './order-rules';
import { OrderStatus as S, PaymentMethod, PaymentStatus } from './order.enums';
import { Role } from 'src/users/enums/role.enum';
import { makeOrderNumber } from './orders.service';

const order = (
  over: Partial<Parameters<typeof allowedNextStatuses>[0]> = {},
) => ({
  status: S.PENDING,
  paymentMethod: PaymentMethod.COD,
  paymentStatus: PaymentStatus.UNPAID,
  deliveryManId: 'rider-1',
  ...over,
});
const admin = { id: 'a', role: Role.ADMIN };
const staff = { id: 's', role: Role.STAFF };
const rider = { id: 'rider-1', role: Role.DELIVERY_MAN };
const otherRider = { id: 'rider-2', role: Role.DELIVERY_MAN };
const buyer = { id: 'b', role: Role.BUYER };

describe('order status rules (contract BE-16)', () => {
  it('follows the transition table', () => {
    expect(canTransition(S.PENDING, S.CONFIRMED)).toBe(true);
    expect(canTransition(S.PROCESSING, S.CANCELLED)).toBe(true);
    expect(canTransition(S.SHIPPED, S.CANCELLED)).toBe(false);
    expect(canTransition(S.OUT_FOR_DELIVERY, S.RETURNED)).toBe(true);
    expect(canTransition(S.DELIVERED, S.RETURNED)).toBe(false);
    expect(canTransition(S.CANCELLED, S.PENDING)).toBe(false);
  });

  it('ADMIN and STAFF get every allowed move', () => {
    expect(allowedNextStatuses(order(), admin)).toEqual([
      S.CONFIRMED,
      S.CANCELLED,
    ]);
    expect(
      allowedNextStatuses(order({ status: S.OUT_FOR_DELIVERY }), staff),
    ).toEqual([S.DELIVERED, S.RETURNED]);
  });

  it('an unpaid card order cannot be confirmed by hand', () => {
    expect(
      allowedNextStatuses(
        order({ paymentMethod: PaymentMethod.STRIPE }),
        admin,
      ),
    ).toEqual([S.CANCELLED]);
    expect(
      allowedNextStatuses(
        order({
          paymentMethod: PaymentMethod.STRIPE,
          paymentStatus: PaymentStatus.PAID,
        }),
        admin,
      ),
    ).toEqual([S.CONFIRMED, S.CANCELLED]);
  });

  it('a delivery man only makes delivery moves, only on his own orders', () => {
    expect(allowedNextStatuses(order({ status: S.SHIPPED }), rider)).toEqual([
      S.OUT_FOR_DELIVERY,
    ]);
    expect(allowedNextStatuses(order({ status: S.PROCESSING }), rider)).toEqual(
      [],
    );
    expect(
      allowedNextStatuses(order({ status: S.SHIPPED }), otherRider),
    ).toEqual([]);
  });

  it('customers get no status buttons', () => {
    expect(allowedNextStatuses(order(), buyer)).toEqual([]);
  });

  it('canPay = STRIPE + UNPAID + PENDING', () => {
    expect(canPay(order({ paymentMethod: PaymentMethod.STRIPE }))).toBe(true);
    expect(canPay(order())).toBe(false);
    expect(
      canPay(
        order({ paymentMethod: PaymentMethod.STRIPE, status: S.CANCELLED }),
      ),
    ).toBe(false);
  });
});

describe('makeOrderNumber', () => {
  it('is ELV-YYMMDD-XXXX with the Bangladesh date', () => {
    // 19:30 UTC on 11 Nov is already 12 Nov in Dhaka (UTC+6)
    expect(makeOrderNumber(new Date('2026-11-11T19:30:00Z'))).toMatch(
      /^ELV-261112-[0-9A-Z]{4}$/,
    );
  });
});
