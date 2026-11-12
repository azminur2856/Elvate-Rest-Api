import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from 'src/auth/decorators/roles.decorator';
import { Role, SHOP_MANAGER_ROLES } from 'src/users/enums/role.enum';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminDeliveriesController } from './admin-deliveries.controller';
import { DeliveryController } from 'src/delivery/delivery.controller';
import { AdminOrdersQueryDto, OrderCorrectionDto } from './dto/admin-order.dto';
import { OrderStatus } from './order.enums';

/** Same lookup as RolesGuard: the route's roles win over the class's. */
const rolesOf = (cls: { prototype: object }, method?: string) =>
  (method
    ? (Reflect.getMetadata(
        ROLES_KEY,
        (cls.prototype as Record<string, object>)[method],
      ) as Role[] | undefined)
    : undefined) ?? (Reflect.getMetadata(ROLES_KEY, cls) as Role[]);

describe('BE-29 who may call what', () => {
  it('correction is ADMIN only (not STAFF)', () => {
    expect(rolesOf(AdminOrdersController, 'correction')).toEqual([Role.ADMIN]);
    expect(rolesOf(AdminOrdersController, 'status')).toEqual([
      ...SHOP_MANAGER_ROLES,
    ]);
  });

  it('the deliveries overview is for ADMIN and STAFF', () => {
    expect(rolesOf(AdminDeliveriesController, 'summary')).toEqual([
      ...SHOP_MANAGER_ROLES,
    ]);
  });

  it('/delivery/* is for delivery men only (ADMIN removed)', () => {
    for (const route of ['list', 'status', 'stats']) {
      expect(rolesOf(DeliveryController, route)).toEqual([Role.DELIVERY_MAN]);
    }
  });
});

describe('BE-29 correction request', () => {
  const errors = async (body: Record<string, unknown>) =>
    (await validate(plainToInstance(OrderCorrectionDto, body))).map(
      (e) => e.property,
    );
  const ok = {
    action: 'DELIVERED',
    reason: 'CUSTOMER_CONFIRMED',
    note: 'Customer called the shop',
  };

  it('accepts a valid body (cashCollected optional at this level)', async () => {
    expect(await errors(ok)).toEqual([]);
    expect(await errors({ ...ok, cashCollected: false })).toEqual([]);
  });

  it('only DELIVERED or RETURN_REQUESTED, a known reason, a 10–500 char note', async () => {
    expect(await errors({ ...ok, action: 'CANCELLED' })).toEqual(['action']);
    expect(await errors({ ...ok, reason: 'BECAUSE' })).toEqual(['reason']);
    // the note is trimmed before its length is checked
    expect(await errors({ ...ok, note: '  long enough  ' })).toEqual([]);
    expect(await errors({ ...ok, note: '    padded     ' })).toEqual(['note']);
    expect(await errors({ ...ok, note: 'short' })).toEqual(['note']);
    expect(await errors({ ...ok, note: 'x'.repeat(501) })).toEqual(['note']);
    expect(await errors({ ...ok, note: undefined })).toEqual(['note']);
    expect(await errors({ ...ok, cashCollected: 'yes' })).toEqual([
      'cashCollected',
    ]);
  });
});

describe('BE-29 admin order list filters', () => {
  const parse = async (query: Record<string, string>) => {
    const dto = plainToInstance(AdminOrdersQueryDto, query);
    return { dto, errors: (await validate(dto)).map((e) => e.property) };
  };

  it('statuses is a CSV of known statuses', async () => {
    const { dto, errors } = await parse({ statuses: 'PROCESSING, SHIPPED' });
    expect(errors).toEqual([]);
    expect(dto.statuses).toEqual([OrderStatus.PROCESSING, OrderStatus.SHIPPED]);
    expect((await parse({ statuses: 'SHIPPED,NOPE' })).errors).toEqual([
      'statuses',
    ]);
  });

  it('unassigned is a boolean, deliveryManId a UUID', async () => {
    expect((await parse({ unassigned: 'true' })).dto.unassigned).toBe(true);
    expect((await parse({ unassigned: 'false' })).dto.unassigned).toBe(false);
    expect((await parse({ unassigned: 'maybe' })).errors).toEqual([
      'unassigned',
    ]);
    expect((await parse({ deliveryManId: 'rider-1' })).errors).toEqual([
      'deliveryManId',
    ]);
  });
});
