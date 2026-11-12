import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService, ConfigType } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import Stripe from 'stripe';
import { DataSource, EntityManager, In, LessThan, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrderStatus, PaymentMethod, PaymentStatus } from './order.enums';
import {
  allowedNextStatuses,
  canPay,
  canTransition,
  CUSTOMER_CANCELLABLE,
  RESTOCKING,
} from './order-rules';
import {
  CancelOrderDto,
  MyOrdersQueryDto,
  PlaceOrderDto,
  QuoteDto,
} from './dto/order.dto';
import { OrderMailer, OrderMailKind } from './order-mailer';
import { CartLine, CartService } from 'src/cart/cart.service';
import { CartItem } from 'src/cart/entities/cart-item.entity';
import {
  AddressesService,
  AddressSnapshot,
  isInsideDhaka,
} from 'src/addresses/addresses.service';
import { CouponService } from 'src/offers/coupon.service';
import { ProductVariant } from 'src/products/entities/product-variant.entity';
import { Product } from 'src/products/entities/product.entity';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { Users } from 'src/users/entities/users.entity';
import { Role, SHOP_MANAGER_ROLES } from 'src/users/enums/role.enum';
import { AuthUser } from 'src/common/auth-user';
import { money } from 'src/common/decimal.transformer';
import { Paginated, pageParams, paginated } from 'src/common/pagination';
import { ownAvatarUrl, staffAvatarUrl } from 'src/common/media';
import stripeConfig from 'src/subscription/config/stripe.config';
import { ReviewsService } from 'src/reviews/reviews.service';

// ---------- response shapes (contract "Shared types") ----------

export type OrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  total: number;
  itemCount: number;
  firstItemImage: string | null;
  createdAt: Date;
  /** BE-28: `avatarUrl` is a /media path (or null), never an ImageKit address. */
  customer?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  deliveryMan?: { id: string; name: string } | null;
};

export type OrderItemView = {
  id: string;
  productId: string | null;
  variantId: string | null;
  slug: string | null;
  productName: string;
  variantLabel: string | null;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  canReview: boolean;
};

export type OrderDetail = Omit<OrderSummary, 'customer' | 'deliveryMan'> & {
  items: OrderItemView[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  couponCode: string | null;
  notes: string | null;
  adminNotes?: string | null;
  shippingAddress: AddressSnapshot;
  statusHistory: {
    status: OrderStatus;
    note: string | null;
    at: Date;
    by: { name: string; role: string } | null;
  }[];
  deliveryMan: { id: string; name: string; phone: string | null } | null;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
  allowedNextStatuses: OrderStatus[];
  canCancel: boolean;
  canPay: boolean;
};

export type Quote = {
  items: CartLine[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  coupon: {
    code: string;
    valid: boolean;
    message: string;
    discount: number;
  } | null;
  freeShippingThreshold: number | null;
};

/** Stripe Checkout sessions must live ≥ 30 min; a little slack for clock skew. */
const CHECKOUT_TTL_SECONDS = 31 * 60;

/** SEC-11: unpaid PENDING orders a customer may have at once. */
export const MAX_UNPAID_PENDING = 3;
/** SEC-11: an unconfirmed COD order gives its stock back after 48 h. */
export const COD_PENDING_MAX_MS = 48 * 60 * 60_000;
/** Card checkout lasts 31 min; after 2 h an unpaid card order is dead. */
export const CARD_PENDING_MAX_MS = 2 * 60 * 60_000;
const STALE_SWEEP_MS = 60 * 60_000;

/** SEC-23: Stripe charge events about order payments. */
const CHARGE_EVENTS = new Set(['charge.refunded', 'charge.dispute.created']);

/** ৳1,035 style amount for log lines. */
const taka = (n: number) =>
  `৳${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const intentId = (
  pi: string | { id: string } | null | undefined,
): string | null => (typeof pi === 'string' ? pi : (pi?.id ?? null));

/** Same lines (variant + quantity) in both carts, in any order. */
export function sameCart(
  a: Pick<CartItem, 'variantId' | 'quantity'>[],
  b: Pick<CartItem, 'variantId' | 'quantity'>[],
): boolean {
  const key = (rows: Pick<CartItem, 'variantId' | 'quantity'>[]) =>
    rows
      .map((r) => `${r.variantId}:${r.quantity}`)
      .sort()
      .join('|');
  return a.length === b.length && key(a) === key(b);
}

/** Taka -> paisa (Stripe amounts are in the smallest unit). */
export const paisa = (n: number) => Math.round(n * 100);

/**
 * SEC-10: a Checkout payment must be in BDT and for the order total
 * (one paisa of rounding allowed). Anything else is never marked paid.
 */
export function paidAmountMatches(
  session: Pick<Stripe.Checkout.Session, 'amount_total' | 'currency'>,
  order: Pick<Order, 'total'>,
): boolean {
  return (
    session.currency?.toLowerCase() === 'bdt' &&
    typeof session.amount_total === 'number' &&
    Math.abs(session.amount_total - paisa(order.total)) <= 1
  );
}

export const fullName = (u?: Pick<Users, 'firstName' | 'lastName'> | null) =>
  u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Deleted user';

const variantLabel = (size: string | null, color: string | null) =>
  [size, color].filter(Boolean).join(' / ') || null;

const isManager = (viewer: AuthUser) =>
  (SHOP_MANAGER_ROLES as readonly string[]).includes(viewer.role);

/**
 * `stock = stock - qty` only when enough stock is left and the product is
 * active. Returns false when no row qualified (the caller answers 409).
 */
export async function decrementStock(
  m: EntityManager,
  variantId: string,
  qty: number,
): Promise<boolean> {
  // pg UPDATE through TypeORM's query() resolves to [rows, affectedCount]
  const [, affected] = await m.query<[unknown[], number]>(
    `UPDATE product_variant v
        SET stock = v.stock - $1, "updatedAt" = now()
       FROM product p
      WHERE v.id = $2 AND v.stock >= $1 AND p.id = v."productId" AND p."isActive" = true`,
    [qty, variantId],
  );
  return affected === 1;
}

/** ELV-YYMMDD-XXXX with the date in Bangladesh time (what customers see). */
export function makeOrderNumber(now = new Date()): string {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .split('-');
  const suffix = randomInt(36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  return `ELV-${y}${m}${d}-${suffix}`;
}

@Injectable()
export class OrdersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private readonly stripe: Stripe | null;
  private readonly frontendUrl = (
    process.env.FRONTEND_URL ?? 'http://localhost:3000'
  ).replace(/\/+$/, '');

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    private readonly cart: CartService,
    private readonly addresses: AddressesService,
    private readonly coupons: CouponService,
    private readonly activityLogs: ActivityLogsService,
    private readonly mailer: OrderMailer,
    private readonly reviews: ReviewsService,
    private readonly config: ConfigService,
    @Inject(stripeConfig.KEY) stripeSettings: ConfigType<typeof stripeConfig>,
  ) {
    this.stripe = stripeSettings.stripeSecretKey
      ? new Stripe(stripeSettings.stripeSecretKey, {
          apiVersion: '2025-05-28.basil',
        })
      : null;
  }

  // ---------- shipping ----------

  shippingRules() {
    const num = (key: string, fallback: number) => {
      const raw = this.config.get<string>(key);
      const v = raw === undefined || raw === '' ? NaN : Number(raw);
      return Number.isFinite(v) && v >= 0 ? v : fallback;
    };
    return {
      insideDhaka: num('SHIPPING_FEE_INSIDE_DHAKA', 60),
      outsideDhaka: num('SHIPPING_FEE_OUTSIDE_DHAKA', 120),
      freeThreshold: num('FREE_SHIPPING_THRESHOLD', 3000),
    };
  }

  /** Free when the amount after the coupon reaches the threshold (contract `Quote`). */
  shippingFee(insideDhaka: boolean, afterDiscount: number): number {
    if (afterDiscount <= 0) return 0;
    const r = this.shippingRules();
    if (r.freeThreshold > 0 && afterDiscount >= r.freeThreshold) return 0;
    return insideDhaka ? r.insideDhaka : r.outsideDhaka;
  }

  // ---------- POST /orders/quote ----------

  async quote(userId: string, dto: QuoteDto): Promise<Quote> {
    const lines = await this.cartLines(userId);
    const subtotal = money(
      lines.filter((l) => l.available).reduce((s, l) => s + l.lineTotal, 0),
    );
    const address = dto.addressId
      ? await this.addresses.findOwn(userId, dto.addressId)
      : await this.addresses.findDefault(userId);

    let coupon: Quote['coupon'] = null;
    if (dto.couponCode) {
      const r = await this.coupons.evaluate(dto.couponCode, userId, subtotal);
      coupon = {
        code: r.code,
        valid: r.valid,
        message: r.message,
        discount: r.discount,
      };
    }
    const discount = coupon?.valid ? coupon.discount : 0;
    const shippingFee = this.shippingFee(
      address ? isInsideDhaka(address.city) : false,
      subtotal - discount,
    );
    const threshold = this.shippingRules().freeThreshold;

    return {
      items: lines,
      subtotal,
      discount,
      shippingFee,
      total: money(subtotal - discount + shippingFee),
      coupon,
      freeShippingThreshold: threshold > 0 ? threshold : null,
    };
  }

  // ---------- stale unpaid orders (SEC-11) ----------

  private sweepTimer: NodeJS.Timeout | null = null;

  onApplicationBootstrap() {
    // once shortly after boot (the free tier sleeps and wakes often), then
    // hourly while awake; place() also sweeps the customer's own orders
    const sweep = () =>
      void this.cancelStaleOrders().catch((err: unknown) =>
        this.logger.warn(`Stale order sweep failed: ${String(err)}`),
      );
    setTimeout(sweep, 30_000).unref();
    this.sweepTimer = setInterval(sweep, STALE_SWEEP_MS);
    this.sweepTimer.unref();
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  /**
   * Gives back the stock held by orders nobody will complete: COD orders not
   * confirmed within 48 h, and card orders whose checkout ended (31 min) over
   * 2 h ago without a payment (e.g. a missed "expired" webhook).
   */
  async cancelStaleOrders(userId?: string): Promise<number> {
    const now = Date.now();
    const pending = {
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      ...(userId ? { userId } : {}),
    };
    const stale = await this.orders.find({
      select: ['id', 'paymentMethod'],
      where: [
        {
          ...pending,
          paymentMethod: PaymentMethod.COD,
          placedAt: LessThan(new Date(now - COD_PENDING_MAX_MS)),
        },
        {
          ...pending,
          paymentMethod: PaymentMethod.STRIPE,
          placedAt: LessThan(new Date(now - CARD_PENDING_MAX_MS)),
        },
      ],
      take: 50,
    });
    for (const o of stale) {
      const note =
        o.paymentMethod === PaymentMethod.COD
          ? 'Not confirmed within 48 hours'
          : 'Card payment was not completed';
      try {
        await this.changeStatus(o.id, OrderStatus.CANCELLED, note, null);
      } catch (err) {
        this.logger.warn(
          `Could not cancel stale order ${o.id}: ${String(err)}`,
        );
      }
    }
    return stale.length;
  }

  // ---------- POST /orders ----------

  async place(
    user: AuthUser,
    dto: PlaceOrderDto,
  ): Promise<{ order: OrderDetail; checkoutUrl: string | null }> {
    // SEC-11: no stock hoarding through piles of unpaid orders
    await this.cancelStaleOrders(user.id);
    const unpaid = await this.orders.count({
      where: {
        userId: user.id,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
      },
    });
    if (unpaid >= MAX_UNPAID_PENDING) {
      throw new ConflictException(
        `You already have ${MAX_UNPAID_PENDING} unpaid orders waiting. Pay for or cancel one before placing another.`,
      );
    }

    const rows = await this.cart.entriesOf(user.id);
    if (rows.length === 0) throw new BadRequestException('Your cart is empty');
    const lines = await this.cart.priceLines(
      rows.map((r) => ({
        id: r.id,
        variantId: r.variantId,
        quantity: r.quantity,
      })),
    );

    // lines whose variant was deleted are gone from `lines`
    const missing = rows.filter(
      (r) => !lines.some((l) => l.variantId === r.variantId),
    );
    const unavailable = lines.filter((l) => !l.available);
    if (missing.length || unavailable.length) {
      throw await this.stockConflict([
        ...missing.map((m) => m.variantId),
        ...unavailable.map((u) => u.variantId),
      ]);
    }

    const address = await this.addresses.findOwn(user.id, dto.addressId);
    const snapshot = this.addresses.snapshot(address);
    const skus = new Map(
      (
        await this.dataSource.getRepository(ProductVariant).find({
          select: ['id', 'sku'],
          where: { id: In(lines.map((l) => l.variantId)) },
        })
      ).map((v) => [v.id, v.sku]),
    );

    const order = await this.dataSource.transaction(async (m) => {
      // SEC-11: lock the cart rows and make sure they are what we priced.
      // A double submit waits here and then finds the cart already emptied.
      const locked = await m.find(CartItem, {
        where: { userId: user.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked.length) throw new BadRequestException('Your cart is empty');
      if (!sameCart(locked, rows)) {
        throw new ConflictException(
          'Your cart changed while the order was being placed. Please review it and try again.',
        );
      }

      const subtotal = money(lines.reduce((s, l) => s + l.lineTotal, 0));

      let discount = 0;
      let couponId: string | null = null;
      let couponCode: string | null = null;
      if (dto.couponCode) {
        const r = await this.coupons.evaluate(
          dto.couponCode,
          user.id,
          subtotal,
          m,
          true,
        );
        if (!r.valid || !r.coupon) throw new BadRequestException(r.message);
        discount = r.discount;
        couponId = r.coupon.id;
        couponCode = r.code;
      }

      // Guarded decrement: never below zero, never for an inactive product.
      // Plain SQL on purpose: TypeORM's UpdateQueryBuilder rewrites the word
      // "product" in raw sub-queries into the relation column "productId".
      const conflicts: string[] = [];
      for (const l of lines) {
        if (!(await decrementStock(m, l.variantId, l.quantity)))
          conflicts.push(l.variantId);
      }
      if (conflicts.length) throw await this.stockConflict(conflicts, m);

      const shippingFee = this.shippingFee(
        snapshot.isInsideDhaka,
        subtotal - discount,
      );
      const now = new Date();
      const saved = await m.save(
        m.create(Order, {
          orderNumber: await this.uniqueOrderNumber(m),
          userId: user.id,
          status: OrderStatus.PENDING,
          paymentMethod: dto.paymentMethod,
          paymentStatus: PaymentStatus.UNPAID,
          subtotal,
          discount,
          shippingFee,
          total: money(subtotal - discount + shippingFee),
          couponId,
          couponCode,
          shippingAddress: snapshot,
          notes: dto.notes || null,
          placedAt: now,
        }),
      );
      await m.insert(
        OrderItem,
        lines.map((l) => ({
          orderId: saved.id,
          productId: l.productId,
          variantId: l.variantId,
          productName: l.name,
          productSlug: l.slug,
          variantLabel: variantLabel(l.size, l.color),
          sku: skus.get(l.variantId) ?? null,
          image: l.image,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          lineTotal: l.lineTotal,
        })),
      );
      await m.insert(OrderStatusHistory, {
        orderId: saved.id,
        status: OrderStatus.PENDING,
        note: 'Order placed',
        changedById: user.id,
      });
      if (couponId)
        await this.coupons.recordUsage(m, couponId, user.id, saved.id);
      await m.delete(CartItem, { userId: user.id });
      return saved;
    });

    let checkoutUrl: string | null = null;
    if (order.paymentMethod === PaymentMethod.STRIPE) {
      try {
        checkoutUrl = await this.createCheckout(order);
      } catch (err) {
        this.logger.error(
          `Stripe checkout for ${order.orderNumber} failed`,
          err as Error,
        );
        await this.dataSource.transaction((m) =>
          this.applyStatus(
            m,
            order,
            OrderStatus.CANCELLED,
            'Card payment could not be started',
            null,
          ),
        );
        throw new BadGatewayException(
          'Card payment is not available right now, so the order was not placed. Please try again or choose cash on delivery.',
        );
      }
    }

    await this.log(
      user.id,
      ActivityType.ORDER_PLACE,
      `User ${user.id} placed order ${order.orderNumber} (${order.paymentMethod}, ৳${order.total})`,
    );
    await this.notify(order.id, 'placed');
    return { order: await this.detailFor(order.id, user), checkoutUrl };
  }

  // ---------- customer reads ----------

  async myOrders(
    userId: string,
    query: MyOrdersQueryDto,
  ): Promise<Paginated<OrderSummary>> {
    const { page, pageSize, skip, take } = pageParams(query, 10);
    const [rows, total] = await this.orders.findAndCount({
      where: { userId, ...(query.status ? { status: query.status } : {}) },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return paginated(await this.summaries(rows, false), total, page, pageSize);
  }

  /** Owner, ADMIN, STAFF or the assigned delivery man; anyone else gets a 404. */
  async detailFor(orderId: string, viewer: AuthUser): Promise<OrderDetail> {
    const order = await this.loadFull(orderId);
    if (!order || !this.canView(order, viewer))
      throw new NotFoundException('Order not found');
    // canReview hides products the owner has already reviewed
    const reviewed =
      order.userId === viewer.id && order.status === OrderStatus.DELIVERED
        ? await this.reviews.reviewedProductIds(
            viewer.id,
            (order.items ?? [])
              .map((i) => i.productId)
              .filter((x): x is string => !!x),
          )
        : new Set<string>();
    return this.detailView(order, viewer, reviewed);
  }

  async sessionStatus(user: AuthUser, sessionId: string) {
    let order = await this.orders.findOne({
      where: { stripeSessionId: sessionId },
    });
    let session: Stripe.Checkout.Session | null = null;
    if (this.stripe) {
      try {
        session = await this.stripe.checkout.sessions.retrieve(sessionId);
      } catch {
        session = null;
      }
      const orderId =
        session?.metadata?.kind === 'order'
          ? session.metadata.orderId
          : undefined;
      if (!order && orderId)
        order = await this.orders.findOne({ where: { id: orderId } });
    }
    if (!order || order.userId !== user.id)
      throw new NotFoundException('Order not found');

    // The success page can arrive before the webhook; settle it here (idempotent).
    if (
      session?.payment_status === 'paid' &&
      order.paymentStatus === PaymentStatus.UNPAID
    ) {
      await this.markPaid(order.id, session);
      order = (await this.orders.findOne({ where: { id: order.id } }))!;
    }
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
    };
  }

  // ---------- customer writes ----------

  async cancelByCustomer(
    user: AuthUser,
    orderId: string,
    dto: CancelOrderDto,
  ): Promise<OrderDetail> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order || order.userId !== user.id)
      throw new NotFoundException('Order not found');
    if (!CUSTOMER_CANCELLABLE.has(order.status)) {
      throw new BadRequestException(
        order.status === OrderStatus.CANCELLED
          ? 'This order is already cancelled'
          : 'This order is already being prepared and can no longer be cancelled',
      );
    }
    const note = dto.reason
      ? `Cancelled by customer: ${dto.reason}`
      : 'Cancelled by customer';
    await this.changeStatus(orderId, OrderStatus.CANCELLED, note, user);
    return this.detailFor(orderId, user);
  }

  async pay(user: AuthUser, orderId: string): Promise<{ checkoutUrl: string }> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order || order.userId !== user.id)
      throw new NotFoundException('Order not found');
    if (!canPay(order))
      throw new BadRequestException('This order does not need a card payment');
    const previousSession = order.stripeSessionId;
    // SEC-10: paid a moment ago but the webhook has not arrived yet? A new
    // checkout would let the customer pay twice.
    if (previousSession && (await this.sessionIsComplete(previousSession))) {
      throw new ConflictException(
        'This order has just been paid. Please wait a moment and reload it.',
      );
    }
    try {
      // Store the new session BEFORE expiring the old one: Stripe's
      // "expired" webhook for the old session must find it already replaced,
      // or it would cancel the order (see expireOrder).
      const checkoutUrl = await this.createCheckout(order);
      if (previousSession) await this.expireSession(previousSession);
      return { checkoutUrl };
    } catch (err) {
      this.logger.error(
        `Stripe checkout for ${order.orderNumber} failed`,
        err as Error,
      );
      throw new BadGatewayException(
        'Card payment is not available right now, please try again later',
      );
    }
  }

  // ---------- status changes (customer cancel, admin, delivery, Stripe) ----------

  /**
   * The one place an order changes status: validates the transition, refunds
   * a paid card order on CANCELLED/RETURNED, restocks, releases the coupon,
   * marks COD paid on DELIVERED, writes history, logs and e-mails.
   */
  async changeStatus(
    orderId: string,
    to: OrderStatus,
    note: string | null,
    actor: AuthUser | null,
  ) {
    const current = await this.orders.findOne({ where: { id: orderId } });
    if (!current) throw new NotFoundException('Order not found');
    if (!canTransition(current.status, to)) {
      throw new BadRequestException(
        `An order that is ${current.status} cannot become ${to}`,
      );
    }

    let refunded = false;
    let updated: Order;
    try {
      updated = await this.dataSource.transaction(async (m) => {
        const order = await m.findOne(Order, {
          where: { id: orderId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!order || !canTransition(order.status, to)) {
          throw new ConflictException(
            'The order changed meanwhile, please reload it',
          );
        }
        // SEC-10: decide the refund under the row lock. markPaid() takes the
        // same lock, so a card payment landing meanwhile is either seen here
        // (and refunded) or waits and then sees the cancelled order.
        // If the refund fails, the transaction rolls back: nothing changes.
        if (
          RESTOCKING.has(to) &&
          order.paymentMethod === PaymentMethod.STRIPE &&
          order.paymentStatus === PaymentStatus.PAID
        ) {
          await this.refund(order);
          refunded = true;
          order.paymentStatus = PaymentStatus.REFUNDED;
        }
        return this.applyStatus(m, order, to, note, actor?.id ?? null);
      });
    } catch (err) {
      // the money already went back: never leave the order claiming PAID
      if (refunded)
        await this.orders.update(orderId, {
          paymentStatus: PaymentStatus.REFUNDED,
        });
      throw err;
    }

    if (
      to === OrderStatus.CANCELLED &&
      updated.stripeSessionId &&
      updated.paymentStatus === PaymentStatus.UNPAID
    ) {
      await this.expireSession(updated.stripeSessionId);
    }

    const activity =
      to === OrderStatus.CANCELLED && actor?.id === updated.userId
        ? ActivityType.ORDER_CANCEL
        : actor?.role === Role.DELIVERY_MAN
          ? ActivityType.DELIVERY_UPDATE_STATUS
          : actor && actor.id !== updated.userId
            ? ActivityType.ADMIN_UPDATE_ORDER_STATUS
            : ActivityType.ORDER_STATUS_UPDATE;
    await this.log(
      actor?.id ?? updated.userId,
      activity,
      `${actor ? `${actor.role} ${actor.id}` : 'System'} moved order ${updated.orderNumber} to ${to}${refunded ? ' (card payment refunded)' : ''}`,
    );
    if (refunded) {
      await this.log(
        updated.userId,
        ActivityType.ORDER_REFUND,
        `Order ${updated.orderNumber}: ৳${updated.total} refunded to card`,
      );
    }

    const mail: Partial<Record<OrderStatus, OrderMailKind>> = {
      [OrderStatus.SHIPPED]: 'shipped',
      [OrderStatus.DELIVERED]: 'delivered',
      [OrderStatus.CANCELLED]: 'cancelled',
    };
    if (mail[to]) await this.notify(updated.id, mail[to], note);
    return updated;
  }

  /** Inside a transaction, with the order row locked. */
  private async applyStatus(
    m: EntityManager,
    order: Order,
    to: OrderStatus,
    note: string | null,
    actorId: string | null,
  ) {
    const now = new Date();
    order.status = to;
    if (to === OrderStatus.CANCELLED) order.cancelledAt = now;
    if (to === OrderStatus.DELIVERED) {
      order.deliveredAt = now;
      if (
        order.paymentMethod === PaymentMethod.COD &&
        order.paymentStatus === PaymentStatus.UNPAID
      ) {
        order.paymentStatus = PaymentStatus.PAID;
        order.paidAt = now;
      }
    }

    const items = await m.find(OrderItem, { where: { orderId: order.id } });
    if (RESTOCKING.has(to)) {
      for (const i of items) {
        if (i.variantId)
          await m.increment(
            ProductVariant,
            { id: i.variantId },
            'stock',
            i.quantity,
          );
      }
      await this.coupons.releaseUsage(m, order.id);
    }
    if (to === OrderStatus.DELIVERED) {
      for (const i of items) {
        if (i.productId)
          await m.increment(
            Product,
            { id: i.productId },
            'soldCount',
            i.quantity,
          );
      }
    }

    await m.update(
      Order,
      { id: order.id },
      {
        status: order.status,
        paymentStatus: order.paymentStatus,
        paidAt: order.paidAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt,
      },
    );
    await m.insert(OrderStatusHistory, {
      orderId: order.id,
      status: to,
      note,
      changedById: actorId,
    });
    return order;
  }

  // ---------- Stripe (webhook is shared with subscriptions) ----------

  isOrderEvent(event: Stripe.Event): boolean {
    // SEC-23: refunds / disputes made in the Stripe dashboard (subscriptions
    // ignore charge events; handleStripeEvent finds the order, if any)
    if (CHARGE_EVENTS.has(event.type)) return true;
    if (!event.type.startsWith('checkout.session.')) return false;
    const session = event.data.object as Stripe.Checkout.Session;
    return session.metadata?.kind === 'order';
  }

  async handleStripeEvent(event: Stripe.Event) {
    if (event.type === 'charge.refunded') {
      return this.chargeRefunded(event.data.object);
    }
    if (event.type === 'charge.dispute.created') {
      return this.chargeDisputed(event.data.object);
    }
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (!orderId) return;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (session.payment_status === 'paid')
          await this.markPaid(orderId, session);
        return;
      case 'checkout.session.expired':
        return this.expireOrder(orderId, session.id);
      default:
        return;
    }
  }

  /**
   * SEC-23: a refund made in the Stripe dashboard. A full refund marks the
   * order REFUNDED (status unchanged: staff decide what happens to the
   * parcel); a partial one is only logged. Takes the order row lock, so the
   * event for a refund Elvate itself made (already REFUNDED under that
   * lock) is a no-op.
   */
  private async chargeRefunded(charge: Stripe.Charge) {
    const paymentIntent = intentId(charge.payment_intent);
    if (!paymentIntent) return;
    const order = await this.dataSource.transaction(async (m) => {
      const o = await m.findOne(Order, {
        where: { stripePaymentIntentId: paymentIntent },
        lock: { mode: 'pessimistic_write' },
      });
      if (!o || o.paymentStatus !== PaymentStatus.PAID) return null;
      if (charge.refunded) {
        await m.update(
          Order,
          { id: o.id },
          { paymentStatus: PaymentStatus.REFUNDED },
        );
      }
      return o;
    });
    if (!order) return;
    const amount = taka(charge.amount_refunded / 100);
    await this.log(
      order.userId,
      ActivityType.ORDER_REFUND,
      charge.refunded
        ? `Order ${order.orderNumber}: refunded in the Stripe dashboard (${amount})`
        : `Order ${order.orderNumber}: partly refunded in the Stripe dashboard (${amount}); still marked paid`,
    );
  }

  /** SEC-23: the customer's bank opened a dispute; staff must answer in Stripe. */
  private async chargeDisputed(dispute: Stripe.Dispute) {
    const paymentIntent = intentId(dispute.payment_intent);
    if (!paymentIntent) return;
    const order = await this.orders.findOne({
      where: { stripePaymentIntentId: paymentIntent },
    });
    if (!order) return;
    this.logger.warn(
      `Order ${order.orderNumber}: card payment disputed (${dispute.reason})`,
    );
    await this.log(
      order.userId,
      ActivityType.ORDER_DISPUTE,
      `Order ${order.orderNumber}: card payment disputed (${dispute.reason}, ${taka(dispute.amount / 100)}); respond in the Stripe dashboard`,
    );
  }

  /** PAID + auto CONFIRMED. Idempotent; a payment that lands on a cancelled order is refunded. */
  private async markPaid(orderId: string, session: Stripe.Checkout.Session) {
    const paymentIntent =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    let refundAfterCancel: Order | null = null;
    // SEC-10: payments to give back without touching the order
    let strayPayment: { order: Order; reason: string } | null = null;

    const result = await this.dataSource.transaction(async (m) => {
      const order = await m.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) return null;
      if (!paidAmountMatches(session, order)) {
        strayPayment = {
          order,
          reason: `paid ${session.amount_total ?? '?'} ${session.currency ?? '?'} instead of ${paisa(order.total)} bdt`,
        };
        return null;
      }
      if (order.paymentStatus !== PaymentStatus.UNPAID) {
        // already paid (or refunded): a different payment is a duplicate
        if (paymentIntent && paymentIntent !== order.stripePaymentIntentId) {
          strayPayment = { order, reason: 'second payment for the order' };
        }
        return null;
      }
      order.stripePaymentIntentId = paymentIntent;
      order.stripeSessionId = session.id;

      if (order.status === OrderStatus.CANCELLED) {
        await m.update(
          Order,
          { id: order.id },
          { stripePaymentIntentId: paymentIntent, stripeSessionId: session.id },
        );
        refundAfterCancel = order;
        return null;
      }

      const now = new Date();
      await m.update(
        Order,
        { id: order.id },
        {
          paymentStatus: PaymentStatus.PAID,
          paidAt: now,
          stripePaymentIntentId: paymentIntent,
          stripeSessionId: session.id,
        },
      );
      // applyStatus() writes these fields from the in-memory order, so keep it current
      order.paymentStatus = PaymentStatus.PAID;
      order.paidAt = now;
      if (order.status === OrderStatus.PENDING) {
        await this.applyStatus(
          m,
          order,
          OrderStatus.CONFIRMED,
          'Card payment received',
          null,
        );
      }
      return order;
    });

    if (result) {
      await this.log(
        result.userId,
        ActivityType.ORDER_PAID,
        `Order ${result.orderNumber} paid by card (৳${result.total})`,
      );
    }
    const toRefund = refundAfterCancel as Order | null;
    if (toRefund) {
      await this.refund(toRefund);
      await this.orders.update(toRefund.id, {
        paymentStatus: PaymentStatus.REFUNDED,
      });
      await this.log(
        toRefund.userId,
        ActivityType.ORDER_REFUND,
        `Order ${toRefund.orderNumber} was paid after it had been cancelled; ৳${toRefund.total} refunded`,
      );
    }
    const stray = strayPayment as { order: Order; reason: string } | null;
    if (stray && paymentIntent) {
      this.logger.warn(
        `Order ${stray.order.orderNumber}: refunding payment ${paymentIntent} (${stray.reason})`,
      );
      await this.refundPayment(paymentIntent, stray.order);
      await this.log(
        stray.order.userId,
        ActivityType.ORDER_REFUND,
        `Order ${stray.order.orderNumber}: card payment refunded (${stray.reason})`,
      );
    }
  }

  /** Session expired unpaid → cancel + restock, unless a newer session (POST /pay) replaced it. */
  private async expireOrder(orderId: string, sessionId: string) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (
      !order ||
      order.stripeSessionId !== sessionId ||
      order.status !== OrderStatus.PENDING ||
      order.paymentStatus !== PaymentStatus.UNPAID
    ) {
      return;
    }
    try {
      await this.changeStatus(
        orderId,
        OrderStatus.CANCELLED,
        'Card payment was not completed in time',
        null,
      );
    } catch (err) {
      if (!(err instanceof ConflictException)) throw err; // already moved on
    }
  }

  private async createCheckout(order: Order): Promise<string> {
    if (!this.stripe) throw new Error('STRIPE_SECRET_KEY is not configured');
    const [items, user] = await Promise.all([
      this.orderItems.find({ where: { orderId: order.id } }),
      order.userId
        ? this.dataSource
            .getRepository(Users)
            .findOne({ where: { id: order.userId } })
        : null,
    ]);
    const units = items.reduce((n, i) => n + i.quantity, 0);

    // Stripe line items cannot be negative, so a discounted order is one summary line.
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      order.discount > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: 'bdt',
                unit_amount: paisa(order.total),
                product_data: {
                  name: `Elvate order ${order.orderNumber}`,
                  description: `${units} item(s), coupon ${order.couponCode ?? ''} (−৳${order.discount}), delivery ৳${order.shippingFee}`,
                },
              },
            },
          ]
        : [
            ...items.map((i) => ({
              quantity: i.quantity,
              price_data: {
                currency: 'bdt',
                unit_amount: paisa(i.unitPrice),
                product_data: {
                  name: i.variantLabel
                    ? `${i.productName} (${i.variantLabel})`
                    : i.productName,
                  ...(i.image?.startsWith('https://')
                    ? { images: [i.image] }
                    : {}),
                },
              },
            })),
            ...(order.shippingFee > 0
              ? [
                  {
                    quantity: 1,
                    price_data: {
                      currency: 'bdt',
                      unit_amount: paisa(order.shippingFee),
                      product_data: { name: 'Delivery' },
                    },
                  },
                ]
              : []),
          ];

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: user?.email,
      client_reference_id: order.id,
      metadata: {
        kind: 'order',
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId ?? '',
      },
      payment_intent_data: {
        metadata: {
          kind: 'order',
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
      },
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS,
      success_url: `${this.frontendUrl}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.frontendUrl}/orders/${order.id}?payment=cancelled`,
    });
    await this.orders.update(order.id, { stripeSessionId: session.id });
    order.stripeSessionId = session.id;
    if (!session.url) throw new Error('Stripe returned no checkout URL');
    return session.url;
  }

  private async refund(order: Order) {
    if (!this.stripe || !order.stripePaymentIntentId) {
      throw new BadGatewayException(
        'This card payment cannot be refunded automatically; please contact support',
      );
    }
    try {
      await this.stripe.refunds.create(
        {
          payment_intent: order.stripePaymentIntentId,
          metadata: { orderId: order.id },
        },
        { idempotencyKey: `refund-order-${order.id}` },
      );
    } catch (err) {
      this.logger.error(`Refund for ${order.orderNumber} failed`, err as Error);
      throw new BadGatewayException(
        'The card refund failed, so the order was not changed. Please try again.',
      );
    }
  }

  /** True when Stripe already completed this Checkout session (paid). */
  private async sessionIsComplete(sessionId: string): Promise<boolean> {
    if (!this.stripe) return false;
    try {
      const s = await this.stripe.checkout.sessions.retrieve(sessionId);
      return s.status === 'complete';
    } catch {
      return false; // unknown or expired session: a new checkout is fine
    }
  }

  /** SEC-10: refund one specific payment (duplicate or wrong amount). */
  private async refundPayment(paymentIntentId: string, order: Order) {
    if (!this.stripe) return;
    try {
      await this.stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          metadata: { orderId: order.id, reason: 'not-for-this-order' },
        },
        { idempotencyKey: `refund-pi-${paymentIntentId}` },
      );
    } catch (err) {
      this.logger.error(
        `Refund of ${paymentIntentId} for ${order.orderNumber} failed`,
        err as Error,
      );
      throw err; // let Stripe retry the webhook
    }
  }

  private async expireSession(sessionId: string) {
    if (!this.stripe) return;
    try {
      await this.stripe.checkout.sessions.expire(sessionId);
    } catch {
      // already expired or completed
    }
  }

  // ---------- views ----------

  canView(order: Pick<Order, 'userId' | 'deliveryManId'>, viewer: AuthUser) {
    return (
      order.userId === viewer.id ||
      isManager(viewer) ||
      (viewer.role === Role.DELIVERY_MAN && order.deliveryManId === viewer.id)
    );
  }

  loadFull(orderId: string) {
    return this.orders.findOne({
      where: { id: orderId },
      relations: {
        items: true,
        history: { changedBy: true },
        user: true,
        deliveryMan: true,
      },
      order: { history: { createdAt: 'ASC' }, items: { productName: 'ASC' } },
    });
  }

  detailView(
    order: Order,
    viewer: AuthUser,
    reviewed: Set<string> = new Set(),
  ): OrderDetail {
    const isOwner = order.userId === viewer.id;
    const manager = isManager(viewer);
    const delivered = order.status === OrderStatus.DELIVERED;
    const items = order.items ?? [];

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      total: order.total,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      firstItemImage: items.find((i) => i.image)?.image ?? null,
      createdAt: order.createdAt,
      items: items.map((i) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        slug: i.productId ? i.productSlug : null,
        productName: i.productName,
        variantLabel: i.variantLabel,
        image: i.image,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        canReview:
          isOwner &&
          delivered &&
          i.productId !== null &&
          !reviewed.has(i.productId),
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      shippingFee: order.shippingFee,
      couponCode: order.couponCode,
      notes: order.notes,
      ...(manager ? { adminNotes: order.adminNotes } : {}),
      shippingAddress: order.shippingAddress,
      statusHistory: (order.history ?? []).map((h) => ({
        status: h.status,
        note: h.note,
        at: h.createdAt,
        by: h.changedBy
          ? { name: fullName(h.changedBy), role: h.changedBy.role }
          : null,
      })),
      deliveryMan: order.deliveryMan
        ? {
            id: order.deliveryMan.id,
            name: fullName(order.deliveryMan),
            phone: order.deliveryMan.phone ?? null,
          }
        : null,
      customer: {
        id: order.user?.id ?? '',
        name: fullName(order.user),
        email: order.user?.email ?? '',
        phone: order.user?.phone ?? order.shippingAddress?.phone ?? null,
        // the owner cannot open /media/users/..., so they get their own path
        avatarUrl: isOwner
          ? ownAvatarUrl(order.user, 'sm')
          : staffAvatarUrl(order.user, 'sm'),
      },
      allowedNextStatuses: allowedNextStatuses(order, viewer),
      canCancel: isOwner && CUSTOMER_CANCELLABLE.has(order.status),
      canPay: isOwner && canPay(order),
    };
  }

  /** List rows; `withPeople` adds customer + deliveryMan (admin lists). */
  async summaries(rows: Order[], withPeople: boolean): Promise<OrderSummary[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const agg = await this.orderItems
      .createQueryBuilder('i')
      .select('i.orderId', 'orderId')
      .addSelect('SUM(i.quantity)', 'units')
      .addSelect(
        '(ARRAY_AGG(i.image ORDER BY i.productName) FILTER (WHERE i.image IS NOT NULL))[1]',
        'image',
      )
      .where('i.orderId IN (:...ids)', { ids })
      .groupBy('i.orderId')
      .getRawMany<{ orderId: string; units: string; image: string | null }>();
    const byOrder = new Map(agg.map((a) => [a.orderId, a]));

    let people = new Map<string, Users>();
    if (withPeople) {
      const userIds = [
        ...new Set(
          rows
            .flatMap((r) => [r.userId, r.deliveryManId])
            .filter((x): x is string => !!x),
        ),
      ];
      if (userIds.length) {
        const users = await this.dataSource
          .getRepository(Users)
          .find({ where: { id: In(userIds) } });
        people = new Map(users.map((u) => [u.id, u]));
      }
    }

    return rows.map((o) => {
      const a = byOrder.get(o.id);
      const summary: OrderSummary = {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        total: o.total,
        itemCount: Number(a?.units ?? 0),
        firstItemImage: a?.image ?? null,
        createdAt: o.createdAt,
      };
      if (withPeople) {
        const c = o.userId ? people.get(o.userId) : undefined;
        const d = o.deliveryManId ? people.get(o.deliveryManId) : undefined;
        summary.customer = {
          id: c?.id ?? '',
          name: fullName(c),
          email: c?.email ?? '',
          avatarUrl: staffAvatarUrl(c, 'sm'),
        };
        summary.deliveryMan = d ? { id: d.id, name: fullName(d) } : null;
      }
      return summary;
    });
  }

  // ---------- helpers ----------

  private async cartLines(userId: string) {
    const rows = await this.cart.entriesOf(userId);
    return this.cart.priceLines(
      rows.map((r) => ({
        id: r.id,
        variantId: r.variantId,
        quantity: r.quantity,
      })),
    );
  }

  /** 409 body the checkout can point at (contract `POST /orders`). */
  private async stockConflict(
    variantIds: string[],
    m: EntityManager = this.dataSource.manager,
  ) {
    const unique = [...new Set(variantIds)];
    const variants = await m.find(ProductVariant, {
      where: { id: In(unique) },
      relations: { product: true },
    });
    const now = new Map(
      variants.map((v) => [v.id, v.product.isActive ? v.stock : 0]),
    );
    return new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      message:
        'Some items in your cart are no longer available in the requested quantity',
      items: unique.map((variantId) => ({
        variantId,
        available: now.get(variantId) ?? 0,
      })),
    });
  }

  private async uniqueOrderNumber(m: EntityManager) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = makeOrderNumber();
      if (!(await m.exists(Order, { where: { orderNumber: candidate } })))
        return candidate;
    }
    throw new ConflictException(
      'Could not allocate an order number, please retry',
    );
  }

  async notify(orderId: string, kind: OrderMailKind, note?: string | null) {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: { user: true, items: true },
    });
    if (!order?.user) return;
    await this.mailer.send(
      kind,
      order,
      { email: order.user.email, name: fullName(order.user) },
      order.items,
      note,
    );
  }

  private log(
    userId: string | null,
    activity: ActivityType,
    description: string,
  ) {
    return this.activityLogs.createActivityLog({
      activity,
      description,
      user: userId ? ({ id: userId } as Users) : null,
    });
  }
}
