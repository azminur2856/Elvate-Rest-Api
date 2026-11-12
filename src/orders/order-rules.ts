import { Role } from 'src/users/enums/role.enum';
import { OrderStatus, PaymentMethod, PaymentStatus } from './order.enums';

/**
 * Contract "Status rules". CANCELLED, RETURNED and DELIVERED are final.
 * SEC-09: a parcel coming back is first RETURN_REQUESTED (rider); only
 * ADMIN / STAFF turn it into RETURNED, which refunds and restocks.
 * BE-29: ADMIN / STAFF manage deliveries but never perform them; "send out
 * again" goes back to SHIPPED so the delivery man picks it up once more.
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [
    OrderStatus.DELIVERED,
    OrderStatus.RETURN_REQUESTED,
  ],
  // confirmed back in the shop, or sent out again (rider mistake / retry)
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURNED, OrderStatus.SHIPPED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURNED]: [],
};

/**
 * Delivery progress: only the assigned delivery man makes these moves
 * (BE-29: not ADMIN / STAFF; the admin has the logged correction instead).
 */
export const DELIVERY_MOVES = new Set([
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.RETURN_REQUESTED,
]);

/** Statuses that put the stock back and release the coupon. */
export const RESTOCKING = new Set([
  OrderStatus.CANCELLED,
  OrderStatus.RETURNED,
]);

/** The customer may cancel before the order is being prepared. */
export const CUSTOMER_CANCELLABLE = new Set([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
]);

type OrderState = {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deliveryManId: string | null;
};

/**
 * `allowedNextStatuses` for the caller (drives the UI buttons).
 * - ADMIN / STAFF: every rule transition except the delivery moves and
 *   confirming an unpaid card order by hand (a paid card order confirms itself).
 * - DELIVERY_MAN: only the delivery moves, only on his own orders.
 * - customers: none (they use canCancel).
 */
export function allowedNextStatuses(
  order: OrderState,
  viewer: { id: string; role: Role },
): OrderStatus[] {
  let next = TRANSITIONS[order.status];
  if (
    order.paymentMethod === PaymentMethod.STRIPE &&
    order.paymentStatus !== PaymentStatus.PAID
  ) {
    next = next.filter((s) => s !== OrderStatus.CONFIRMED);
  }
  switch (viewer.role) {
    case Role.ADMIN:
    case Role.STAFF:
      return next.filter((s) => !DELIVERY_MOVES.has(s));
    case Role.DELIVERY_MAN:
      return order.deliveryManId === viewer.id
        ? next.filter((s) => DELIVERY_MOVES.has(s))
        : [];
    default:
      return [];
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[from].includes(to);
}

/** canPay = STRIPE && UNPAID && still pending. */
export function canPay(order: OrderState) {
  return (
    order.paymentMethod === PaymentMethod.STRIPE &&
    order.paymentStatus === PaymentStatus.UNPAID &&
    order.status === OrderStatus.PENDING
  );
}
