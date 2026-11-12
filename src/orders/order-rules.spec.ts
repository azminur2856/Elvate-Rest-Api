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
    // SEC-09: a return is requested first, then confirmed
    expect(canTransition(S.OUT_FOR_DELIVERY, S.RETURNED)).toBe(false);
    expect(canTransition(S.OUT_FOR_DELIVERY, S.RETURN_REQUESTED)).toBe(true);
    expect(canTransition(S.RETURN_REQUESTED, S.RETURNED)).toBe(true);
    // BE-29: "send out again" goes back to SHIPPED
    expect(canTransition(S.RETURN_REQUESTED, S.SHIPPED)).toBe(true);
    expect(canTransition(S.RETURN_REQUESTED, S.OUT_FOR_DELIVERY)).toBe(false);
    expect(canTransition(S.DELIVERED, S.RETURNED)).toBe(false);
    expect(canTransition(S.CANCELLED, S.PENDING)).toBe(false);
  });

  it('ADMIN and STAFF manage the order but never perform the delivery', () => {
    expect(allowedNextStatuses(order(), admin)).toEqual([
      S.CONFIRMED,
      S.CANCELLED,
    ]);
    for (const viewer of [admin, staff]) {
      expect(allowedNextStatuses(order({ status: S.SHIPPED }), viewer)).toEqual(
        [],
      );
      expect(
        allowedNextStatuses(order({ status: S.OUT_FOR_DELIVERY }), viewer),
      ).toEqual([]);
      expect(
        allowedNextStatuses(order({ status: S.RETURN_REQUESTED }), viewer),
      ).toEqual([S.RETURNED, S.SHIPPED]);
    }
  });

  it('SEC-09: a rider can request a return but never confirm one', () => {
    expect(
      allowedNextStatuses(order({ status: S.OUT_FOR_DELIVERY }), rider),
    ).toEqual([S.DELIVERED, S.RETURN_REQUESTED]);
    // BE-29: sending it out again is a staff decision
    expect(
      allowedNextStatuses(order({ status: S.RETURN_REQUESTED }), rider),
    ).toEqual([]);
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
