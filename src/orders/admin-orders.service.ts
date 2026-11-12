import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderStatus, PaymentMethod, PaymentStatus } from './order.enums';
import { allowedNextStatuses, DELIVERY_MOVES } from './order-rules';
import {
  fullName,
  OrderDetail,
  OrderSummary,
  OrdersService,
} from './orders.service';
import {
  AdminOrdersQueryDto,
  AssignDeliveryDto,
  CORRECTION_REASON_LABELS,
  OrderCorrectionDto,
  OrderNotesDto,
  UpdateOrderStatusDto,
} from './dto/admin-order.dto';
import { OrderMailer } from './order-mailer';
import { Users } from 'src/users/entities/users.entity';
import { Role } from 'src/users/enums/role.enum';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { actorLabel, AuthUser } from 'src/common/auth-user';
import { money } from 'src/common/decimal.transformer';
import { Paginated, pageParams, paginated } from 'src/common/pagination';
import { toImgPath } from 'src/common/media';

/** Orders on their way to the customer (cash may still be collected). */
export const ON_THE_WAY = [
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
];

/**
 * Orders a delivery man is still working on (for `activeOrders`): a
 * RETURN_REQUESTED parcel stays with him until staff confirm it is back.
 */
export const ACTIVE_DELIVERY = [...ON_THE_WAY, OrderStatus.RETURN_REQUESTED];
const ASSIGNABLE = new Set([OrderStatus.PROCESSING, OrderStatus.SHIPPED]);

/** GET /admin/deliveries/summary (BE-29). */
export type DeliverySummary = {
  /** PROCESSING / SHIPPED without a delivery man. */
  waitingForDeliveryMan: number;
  /** SHIPPED with a delivery man, not picked up yet. */
  assignedNotPickedUp: number;
  outForDelivery: number;
  deliveredToday: number;
  returnRequests: number;
  /** Cash on delivery collected today (paid COD orders delivered today). */
  cashCollectedToday: number;
  deliveryMen: {
    id: string;
    name: string;
    phone: string | null;
    active: boolean;
    outNow: number;
    deliveredToday: number;
    cashCollectedToday: number;
  }[];
};
export const ONLY_DELIVERY_MAN =
  'Only the assigned delivery man can update delivery progress.';
const LOW_STOCK = 5;

const zeroStatuses = () =>
  Object.fromEntries(Object.values(OrderStatus).map((s) => [s, 0])) as Record<
    OrderStatus,
    number
  >;

/** "2026-11-11" → that whole day; a full date-time is used as given. */
const isPlainDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Calendar day in Bangladesh for a timestamp column (stored as UTC wall clock). */
const dhakaDay = (col: string) =>
  `to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD')`;

/** Start of today in Bangladesh, as a UTC instant. */
export function startOfDhakaToday(now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
  }).format(now);
  return new Date(`${day}T00:00:00+06:00`);
}

const dhakaDate = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(d);

@Injectable()
export class AdminOrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    private readonly activityLogs: ActivityLogsService,
    private readonly mailer: OrderMailer,
  ) {}

  // ---------- GET /admin/orders ----------

  async list(query: AdminOrdersQueryDto): Promise<
    Paginated<OrderSummary> & {
      counts: Record<OrderStatus, number> & { all: number };
    }
  > {
    const { page, pageSize, skip, take } = pageParams(query, 10);

    /** Every filter except `status` / `statuses` (the tab counts share it). */
    const filtered = () => {
      const qb = this.orders.createQueryBuilder('o').leftJoin('o.user', 'u');
      if (query.deliveryManId)
        qb.andWhere('o.deliveryManId = :dm', { dm: query.deliveryManId });
      if (query.unassigned === true) qb.andWhere('o.deliveryManId IS NULL');
      if (query.paymentStatus)
        qb.andWhere('o.paymentStatus = :ps', { ps: query.paymentStatus });
      if (query.paymentMethod)
        qb.andWhere('o.paymentMethod = :pm', { pm: query.paymentMethod });
      if (query.q) {
        const like = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        qb.andWhere(
          new Brackets((w) =>
            w
              .where('o.orderNumber ILIKE :like')
              .orWhere('u.email ILIKE :like')
              .orWhere(
                "CONCAT(u.firstName, ' ', COALESCE(u.lastName, '')) ILIKE :like",
              ),
          ),
          { like },
        );
      }
      if (query.fromDate)
        qb.andWhere('o.placedAt >= :from', { from: new Date(query.fromDate) });
      if (query.toDate) {
        if (isPlainDate(query.toDate)) {
          const end = new Date(query.toDate);
          end.setUTCDate(end.getUTCDate() + 1);
          qb.andWhere('o.placedAt < :to', { to: end });
        } else {
          qb.andWhere('o.placedAt <= :to', { to: new Date(query.toDate) });
        }
      }
      return qb;
    };

    const listQb = filtered();
    if (query.status)
      listQb.andWhere('o.status = :status', { status: query.status });
    if (query.statuses?.length)
      listQb.andWhere('o.status IN (:...statuses)', {
        statuses: query.statuses,
      });
    const [rows, total] = await listQb
      .orderBy('o.placedAt', 'DESC')
      .addOrderBy('o.id', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const byStatus = await filtered()
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('o.status')
      .getRawMany<{ status: OrderStatus; count: string }>();
    const counts = { ...zeroStatuses(), all: 0 };
    for (const r of byStatus) {
      counts[r.status] = Number(r.count);
      counts.all += Number(r.count);
    }

    return {
      ...paginated(
        await this.ordersService.summaries(rows, true),
        total,
        page,
        pageSize,
      ),
      counts,
    };
  }

  // ---------- writes ----------

  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    actor: AuthUser,
  ): Promise<OrderDetail> {
    const order = await this.mustFind(id);
    if (DELIVERY_MOVES.has(dto.status)) {
      throw new BadRequestException(ONLY_DELIVERY_MAN);
    }
    const allowed = allowedNextStatuses(order, actor);
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        allowed.length
          ? `A ${order.status} order can move to ${allowed.join(' or ')}, not ${dto.status}`
          : `A ${order.status} order cannot change status any more`,
      );
    }
    await this.ordersService.changeStatus(
      id,
      dto.status,
      dto.note || null,
      actor,
    );
    return this.ordersService.detailFor(id, actor);
  }

  async assign(
    id: string,
    dto: AssignDeliveryDto,
    actor: AuthUser,
  ): Promise<OrderDetail> {
    const order = await this.mustFind(id);
    if (!ASSIGNABLE.has(order.status)) {
      throw new BadRequestException(
        `Only PROCESSING or SHIPPED orders can be assigned (this one is ${order.status})`,
      );
    }
    const rider = await this.dataSource
      .getRepository(Users)
      .findOne({ where: { id: dto.deliveryManId } });
    if (!rider || rider.role !== Role.DELIVERY_MAN) {
      throw new BadRequestException('That user is not a delivery man');
    }
    if (!rider.isActive)
      throw new BadRequestException('That delivery man account is inactive');

    await this.orders.update(id, { deliveryManId: rider.id });
    await this.log(
      actor,
      ActivityType.ADMIN_ASSIGN_DELIVERY,
      `${actorLabel(actor)} assigned order ${order.orderNumber} to delivery man ${fullName(rider)} (${rider.id})`,
    );
    return this.ordersService.detailFor(id, actor);
  }

  /**
   * BE-29: ADMIN only. Finishes a delivery stuck in OUT_FOR_DELIVERY (the
   * delivery man cannot do it himself): logged, marked as a correction in
   * the timeline, and the delivery man gets an e-mail. No other status can
   * be corrected, so no step is skipped and final states stay final.
   */
  async correct(
    id: string,
    dto: OrderCorrectionDto,
    actor: AuthUser,
  ): Promise<OrderDetail> {
    const order = await this.mustFind(id);
    if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        'A correction is only possible while the order is out for delivery.',
      );
    }
    const codDelivered =
      dto.action === OrderStatus.DELIVERED &&
      order.paymentMethod === PaymentMethod.COD;
    if (codDelivered && dto.cashCollected === undefined) {
      throw new BadRequestException(
        'cashCollected is required for a cash on delivery order.',
      );
    }
    const reason = CORRECTION_REASON_LABELS[dto.reason];
    const cashCollected = codDelivered ? dto.cashCollected : undefined;
    await this.ordersService.changeStatus(
      id,
      dto.action,
      `Correction: ${reason} — ${dto.note}`,
      actor,
      { reason, cashCollected },
    );

    const rider = order.deliveryManId
      ? await this.dataSource
          .getRepository(Users)
          .findOne({ where: { id: order.deliveryManId } })
      : null;
    if (rider) {
      await this.mailer.sendCorrection(
        order,
        { email: rider.email, name: fullName(rider) },
        { action: dto.action, reason, note: dto.note, cashCollected },
      );
    }
    return this.ordersService.detailFor(id, actor);
  }

  async notes(
    id: string,
    dto: OrderNotesDto,
    actor: AuthUser,
  ): Promise<OrderDetail> {
    const order = await this.mustFind(id);
    await this.orders.update(id, {
      adminNotes: dto.adminNotes?.trim() || null,
    });
    await this.log(
      actor,
      ActivityType.ADMIN_UPDATE_ORDER_NOTES,
      `${actorLabel(actor)} updated the notes of order ${order.orderNumber}`,
    );
    return this.ordersService.detailFor(id, actor);
  }

  // ---------- reads ----------

  async deliveryMen() {
    const riders = await this.dataSource.getRepository(Users).find({
      where: { role: Role.DELIVERY_MAN, isActive: true },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    if (riders.length === 0) return [];
    const active = await this.orders
      .createQueryBuilder('o')
      .select('o.deliveryManId', 'id')
      .addSelect('COUNT(*)', 'count')
      .where('o.deliveryManId IN (:...ids)', { ids: riders.map((r) => r.id) })
      .andWhere('o.status IN (:...statuses)', { statuses: ACTIVE_DELIVERY })
      .groupBy('o.deliveryManId')
      .getRawMany<{ id: string; count: string }>();
    const count = new Map(active.map((a) => [a.id, Number(a.count)]));
    return riders.map((r) => ({
      id: r.id,
      name: fullName(r),
      phone: r.phone ?? null,
      activeOrders: count.get(r.id) ?? 0,
    }));
  }

  /** Overview cards and the delivery men panel (Bangladesh "today"). */
  async deliverySummary(): Promise<DeliverySummary> {
    const today = startOfDhakaToday();
    const params = {
      waiting: [OrderStatus.PROCESSING, OrderStatus.SHIPPED],
      shipped: OrderStatus.SHIPPED,
      out: OrderStatus.OUT_FOR_DELIVERY,
      delivered: OrderStatus.DELIVERED,
      returnRequested: OrderStatus.RETURN_REQUESTED,
      cod: PaymentMethod.COD,
      paid: PaymentStatus.PAID,
      today,
    };
    const deliveredToday = 'o.status = :delivered AND o.deliveredAt >= :today';
    const cashToday = `${deliveredToday} AND o.paymentMethod = :cod AND o.paymentStatus = :paid`;

    const [totals, perRider, riders] = await Promise.all([
      this.orders
        .createQueryBuilder('o')
        .select(
          'COUNT(*) FILTER (WHERE o.status IN (:...waiting) AND o.deliveryManId IS NULL)',
          'waiting',
        )
        .addSelect(
          'COUNT(*) FILTER (WHERE o.status = :shipped AND o.deliveryManId IS NOT NULL)',
          'assigned',
        )
        .addSelect('COUNT(*) FILTER (WHERE o.status = :out)', 'out')
        .addSelect(`COUNT(*) FILTER (WHERE ${deliveredToday})`, 'delivered')
        .addSelect(
          'COUNT(*) FILTER (WHERE o.status = :returnRequested)',
          'returns',
        )
        .addSelect(
          `COALESCE(SUM(o.total) FILTER (WHERE ${cashToday}), 0)`,
          'cash',
        )
        .where(
          '(o.status IN (:...waiting, :out, :returnRequested) OR o.deliveredAt >= :today)',
        )
        .setParameters(params)
        .getRawOne<Record<string, string>>(),
      this.orders
        .createQueryBuilder('o')
        .select('o.deliveryManId', 'id')
        .addSelect('COUNT(*) FILTER (WHERE o.status = :out)', 'out')
        .addSelect(`COUNT(*) FILTER (WHERE ${deliveredToday})`, 'delivered')
        .addSelect(
          `COALESCE(SUM(o.total) FILTER (WHERE ${cashToday}), 0)`,
          'cash',
        )
        .where('o.deliveryManId IS NOT NULL')
        .andWhere('(o.status = :out OR o.deliveredAt >= :today)')
        .setParameters(params)
        .groupBy('o.deliveryManId')
        .getRawMany<{
          id: string;
          out: string;
          delivered: string;
          cash: string;
        }>(),
      this.dataSource.getRepository(Users).find({
        where: { role: Role.DELIVERY_MAN },
        order: { isActive: 'DESC', firstName: 'ASC', lastName: 'ASC' },
      }),
    ]);

    const byRider = new Map(perRider.map((r) => [r.id, r]));
    return {
      waitingForDeliveryMan: Number(totals?.waiting ?? 0),
      assignedNotPickedUp: Number(totals?.assigned ?? 0),
      outForDelivery: Number(totals?.out ?? 0),
      deliveredToday: Number(totals?.delivered ?? 0),
      returnRequests: Number(totals?.returns ?? 0),
      cashCollectedToday: Number(totals?.cash ?? 0),
      deliveryMen: riders.map((r) => {
        const row = byRider.get(r.id);
        return {
          id: r.id,
          name: fullName(r),
          phone: r.phone ?? null,
          active: r.isActive,
          outNow: Number(row?.out ?? 0),
          deliveredToday: Number(row?.delivered ?? 0),
          cashCollectedToday: Number(row?.cash ?? 0),
        };
      }),
    };
  }

  /**
   * Dashboard for the last `days` days (Bangladesh calendar days). Revenue
   * counts PAID orders only (paid card orders + delivered COD).
   */
  async stats(days = 30) {
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 3600 * 1000);
    const inWindow = () =>
      this.orders
        .createQueryBuilder('o')
        .where('o.placedAt >= :since', { since });

    const [totals, pending, byStatus, byMethod, perDay, top, low] =
      await Promise.all([
        inWindow()
          .select('COUNT(*)', 'orders')
          .addSelect(
            'COUNT(*) FILTER (WHERE o.paymentStatus = :paid)',
            'paidOrders',
          )
          .addSelect(
            'COALESCE(SUM(o.total) FILTER (WHERE o.paymentStatus = :paid), 0)',
            'revenue',
          )
          .setParameter('paid', PaymentStatus.PAID)
          .getRawOne<{ orders: string; paidOrders: string; revenue: string }>(),
        this.orders.count({ where: { status: OrderStatus.PENDING } }),
        inWindow()
          .select('o.status', 'key')
          .addSelect('COUNT(*)', 'count')
          .groupBy('o.status')
          .getRawMany<{ key: OrderStatus; count: string }>(),
        inWindow()
          .select('o.paymentMethod', 'key')
          .addSelect('COUNT(*)', 'count')
          .groupBy('o.paymentMethod')
          .getRawMany<{ key: PaymentMethod; count: string }>(),
        inWindow()
          .select(dhakaDay('o.placedAt'), 'date')
          .addSelect('COUNT(*)', 'count')
          .addSelect(
            'COALESCE(SUM(o.total) FILTER (WHERE o.paymentStatus = :paid), 0)',
            'revenue',
          )
          .setParameter('paid', PaymentStatus.PAID)
          .groupBy('date')
          .getRawMany<{ date: string; count: string; revenue: string }>(),
        this.dataSource
          .createQueryBuilder()
          .select('i."productId"', 'productId')
          .addSelect('MAX(i."productName")', 'name')
          .addSelect('MAX(i.image)', 'image')
          .addSelect('SUM(i.quantity)', 'quantity')
          .addSelect('SUM(i."lineTotal")', 'revenue')
          .from('order_item', 'i')
          .innerJoin('orders', 'o', 'o.id = i."orderId"')
          .where('o."placedAt" >= :since', { since })
          .andWhere('o.status NOT IN (:...gone)', {
            gone: [
              OrderStatus.CANCELLED,
              OrderStatus.RETURN_REQUESTED,
              OrderStatus.RETURNED,
            ],
          })
          .andWhere('i."productId" IS NOT NULL')
          .groupBy('i."productId"')
          .orderBy('quantity', 'DESC')
          .limit(5)
          .getRawMany<{
            productId: string;
            name: string;
            image: string | null;
            quantity: string;
            revenue: string;
          }>(),
        this.dataSource
          .createQueryBuilder()
          .select('v.id', 'variantId')
          .addSelect('p.name', 'productName')
          .addSelect('v.size', 'size')
          .addSelect('v.color', 'color')
          .addSelect('v.stock', 'stock')
          .from('product_variant', 'v')
          .innerJoin('product', 'p', 'p.id = v."productId"')
          .where('p."isActive" = true')
          .andWhere('v.stock <= :low', { low: LOW_STOCK })
          .orderBy('v.stock', 'ASC')
          .addOrderBy('p.name', 'ASC')
          .limit(10)
          .getRawMany<{
            variantId: string;
            productName: string;
            size: string | null;
            color: string | null;
            stock: number;
          }>(),
      ]);

    const countByStatus = zeroStatuses();
    for (const r of byStatus) countByStatus[r.key] = Number(r.count);
    const paymentMethodSplit = Object.fromEntries(
      Object.values(PaymentMethod).map((m) => [m, 0]),
    ) as Record<PaymentMethod, number>;
    for (const r of byMethod) paymentMethodSplit[r.key] = Number(r.count);

    // one row per day, including days without orders
    const dayMap = new Map(perDay.map((d) => [d.date, d]));
    const byDay: { date: string; count: number; revenue: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = dhakaDate(new Date(now.getTime() - i * 24 * 3600 * 1000));
      const d = dayMap.get(date);
      byDay.push({
        date,
        count: Number(d?.count ?? 0),
        revenue: Number(d?.revenue ?? 0),
      });
    }

    const revenue = Number(totals?.revenue ?? 0);
    const paidOrders = Number(totals?.paidOrders ?? 0);
    return {
      days,
      totalOrders: Number(totals?.orders ?? 0),
      revenue,
      avgOrderValue: paidOrders ? money(revenue / paidOrders) : 0,
      pendingCount: pending,
      countByStatus,
      paymentMethodSplit,
      byDay,
      topProducts: top.map((t) => ({
        productId: t.productId,
        name: t.name,
        image: toImgPath(t.image), // BE-28
        quantity: Number(t.quantity),
        revenue: Number(t.revenue),
      })),
      lowStock: low.map((l) => ({
        variantId: l.variantId,
        productName: l.productName,
        variantLabel: [l.size, l.color].filter(Boolean).join(' / ') || null,
        stock: Number(l.stock),
      })),
    };
  }

  // ---------- helpers ----------

  private async mustFind(id: string) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private log(actor: AuthUser, activity: ActivityType, description: string) {
    return this.activityLogs.createActivityLog({
      activity,
      description,
      user: { id: actor.id } as Users,
    });
  }
}
