import { computeDiscount, CouponService } from './coupon.service';
import { Coupon, CouponType } from './entities/coupon.entity';

const day = 24 * 3600 * 1000;
const now = new Date('2026-11-11T12:00:00Z');
const coupon = (over: Partial<Coupon> = {}): Coupon =>
  ({
    id: 'c1',
    code: 'SAVE10',
    type: CouponType.PERCENT,
    value: 10,
    minOrderAmount: null,
    maxDiscount: null,
    startsAt: new Date(now.getTime() - day),
    expiresAt: new Date(now.getTime() + day),
    usageLimit: null,
    perUserLimit: null,
    usedCount: 0,
    isPublic: true,
    isActive: true,
    ...over,
  }) as Coupon;

describe('computeDiscount', () => {
  it('PERCENT is capped by maxDiscount', () => {
    expect(computeDiscount(coupon(), 2255)).toBe(225.5);
    expect(computeDiscount(coupon({ maxDiscount: 150 }), 2255)).toBe(150);
  });

  it('FIXED never exceeds the subtotal', () => {
    expect(
      computeDiscount(coupon({ type: CouponType.FIXED, value: 200 }), 150),
    ).toBe(150);
    expect(
      computeDiscount(coupon({ type: CouponType.FIXED, value: 200 }), 900),
    ).toBe(200);
  });
});

describe('CouponService.evaluate', () => {
  const run = async (c: Coupon | null, subtotal = 2000, usedByUser = 0) => {
    const qb = {
      where: () => qb,
      setLock: () => qb,
      getOne: () => Promise.resolve(c),
    };
    const manager = {
      getRepository: () => ({ createQueryBuilder: () => qb }),
      count: () => Promise.resolve(usedByUser),
    };
    const service = new CouponService({ manager } as never);
    return service.evaluate(
      ' save10 ',
      'u1',
      subtotal,
      manager as never,
      false,
      now,
    );
  };

  it('accepts a valid code (case-insensitive) and reports the saving', async () => {
    await expect(run(coupon())).resolves.toMatchObject({
      code: 'SAVE10',
      valid: true,
      discount: 200,
    });
  });

  it.each([
    ['unknown', null, 'not valid'],
    ['inactive', coupon({ isActive: false }), 'not valid'],
    [
      'not started',
      coupon({ startsAt: new Date(now.getTime() + day) }),
      'not active yet',
    ],
    ['expired', coupon({ expiresAt: now }), 'expired'],
    ['fully used', coupon({ usageLimit: 5, usedCount: 5 }), 'fully used'],
  ])('rejects %s coupons', async (_label, c, message) => {
    const r = await run(c);
    expect(r.valid).toBe(false);
    expect(r.discount).toBe(0);
    expect(r.message).toContain(message);
  });

  it('enforces the per-user limit', async () => {
    const r = await run(coupon({ perUserLimit: 1 }), 2000, 1);
    expect(r).toMatchObject({
      valid: false,
      message: 'You have already used this coupon',
    });
  });

  it('enforces the minimum order and says how much is missing', async () => {
    const r = await run(coupon({ minOrderAmount: 2500 }), 2000);
    expect(r.valid).toBe(false);
    expect(r.message).toContain('৳500 more');
  });
});
