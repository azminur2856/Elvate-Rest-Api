import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from 'src/orders/entities/order.entity';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from 'src/orders/order.enums';
import { allowedNextStatuses } from 'src/orders/order-rules';
import {
  OrderDetail,
  OrderSummary,
  OrdersService,
} from 'src/orders/orders.service';
import { ACTIVE_DELIVERY, ON_THE_WAY } from 'src/orders/admin-orders.service';
import { DeliveryOrdersQueryDto, DeliveryStatusDto } from './dto/delivery.dto';
import { AddressSnapshot } from 'src/addresses/addresses.service';
import { AuthUser } from 'src/common/auth-user';
import { Role } from 'src/users/enums/role.enum';
import { Paginated, pageParams, paginated } from 'src/common/pagination';

export type DeliveryOrder = OrderSummary & {
  shippingAddress: AddressSnapshot;
  customerPhone: string | null;
  /** Cash to collect at the door (COD + unpaid + still on its way), else 0. */
  codDue: number;
};

const COMPLETED = [OrderStatus.DELIVERED, OrderStatus.RETURNED];

/** Start of today in Bangladesh, as a UTC instant. */
function startOfDhakaToday(now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
  }).format(now);
  return new Date(`${day}T00:00:00+06:00`);
}

/**
 * Delivery man views (BE-17). A DELIVERY_MAN only ever sees orders assigned
 * to him; an ADMIN calling the same routes sees every assigned order.
 */
@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly ordersService: OrdersService,
  ) {}

  async list(
    viewer: AuthUser,
    query: DeliveryOrdersQueryDto,
  ): Promise<Paginated<DeliveryOrder>> {
    const { page, pageSize, skip, take } = pageParams(query, 10);
    const completed = query.scope === 'completed';
    const qb = this.mine(viewer).andWhere('o.status IN (:...statuses)', {
      statuses: completed ? COMPLETED : ACTIVE_DELIVERY,
    });
    // active: oldest first (deliver in order); completed: most recent first
    if (completed) qb.orderBy('o.updatedAt', 'DESC');
    else qb.orderBy('o.placedAt', 'ASC');
    const [rows, total] = await qb
      .addOrderBy('o.id', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const summaries = await this.ordersService.summaries(rows, true);
    const byId = new Map(rows.map((r) => [r.id, r]));
    return paginated(
      summaries.map((s) => {
        const o = byId.get(s.id)!;
        return {
          ...s,
          shippingAddress: o.shippingAddress,
          customerPhone: o.shippingAddress?.phone ?? null,
          // only while the parcel is still on its way (not for returns)
          codDue:
            o.paymentMethod === PaymentMethod.COD &&
            o.paymentStatus === PaymentStatus.UNPAID &&
            ON_THE_WAY.includes(o.status)
              ? o.total
              : 0,
        };
      }),
      total,
      page,
      pageSize,
    );
  }

  async updateStatus(
    viewer: AuthUser,
    orderId: string,
    dto: DeliveryStatusDto,
  ): Promise<OrderDetail> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    // someone else's order looks like no order at all
    if (
      !order ||
      (viewer.role !== Role.ADMIN && order.deliveryManId !== viewer.id)
    ) {
      throw new NotFoundException('Order not found');
    }
    if (!order.deliveryManId)
      throw new BadRequestException('This order has no delivery man yet');

    const allowed = allowedNextStatuses(order, viewer).filter((s) =>
      ACTIVE_DELIVERY.concat(COMPLETED).includes(s),
    );
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        allowed.length
          ? `This order can move to ${allowed.join(' or ')}, not ${dto.status}`
          : `A ${order.status} order cannot be updated from the delivery app`,
      );
    }
    await this.ordersService.changeStatus(
      orderId,
      dto.status,
      dto.note || null,
      viewer,
    );
    return this.ordersService.detailFor(orderId, viewer);
  }

  async stats(viewer: AuthUser) {
    const today = startOfDhakaToday();
    const base = () => this.mine(viewer);
    const [assigned, outForDelivery, deliveredToday, deliveredTotal, cod] =
      await Promise.all([
        base()
          .andWhere('o.status IN (:...a)', { a: ACTIVE_DELIVERY })
          .getCount(),
        base()
          .andWhere('o.status = :s', { s: OrderStatus.OUT_FOR_DELIVERY })
          .getCount(),
        base()
          .andWhere('o.status = :d', { d: OrderStatus.DELIVERED })
          .andWhere('o.deliveredAt >= :today', { today })
          .getCount(),
        base()
          .andWhere('o.status = :d', { d: OrderStatus.DELIVERED })
          .getCount(),
        base()
          .select('COALESCE(SUM(o.total), 0)', 'sum')
          .andWhere('o.status = :d', { d: OrderStatus.DELIVERED })
          .andWhere('o.paymentMethod = :cod', { cod: PaymentMethod.COD })
          .andWhere('o.deliveredAt >= :today', { today })
          .getRawOne<{ sum: string }>(),
      ]);
    return {
      assigned,
      outForDelivery,
      deliveredToday,
      deliveredTotal,
      codCollectedToday: Number(cod?.sum ?? 0),
    };
  }

  /** Orders this viewer may see in the delivery app. */
  private mine(viewer: AuthUser) {
    const qb = this.orders.createQueryBuilder('o');
    if (viewer.role === Role.ADMIN) qb.where('o.deliveryManId IS NOT NULL');
    else qb.where('o.deliveryManId = :me', { me: viewer.id });
    return qb;
  }
}
