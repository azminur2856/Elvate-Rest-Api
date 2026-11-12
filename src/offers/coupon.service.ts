import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Coupon, CouponType } from './entities/coupon.entity';
import { CouponUsage } from './entities/coupon-usage.entity';
import { money } from 'src/common/decimal.transformer';

export type CouponResult = {
  code: string;
  valid: boolean;
  /** Shown next to the coupon field. */
  message: string;
  discount: number;
  coupon: Coupon | null;
};

const taka = (n: number) =>
  `৳${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** PERCENT is capped by maxDiscount; FIXED never exceeds the subtotal. */
export function computeDiscount(
  coupon: Pick<Coupon, 'type' | 'value' | 'maxDiscount'>,
  subtotal: number,
): number {
  if (subtotal <= 0) return 0;
  let discount =
    coupon.type === CouponType.PERCENT
      ? (subtotal * coupon.value) / 100
      : coupon.value;
  if (coupon.type === CouponType.PERCENT && coupon.maxDiscount !== null) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  return money(Math.max(0, Math.min(discount, subtotal)));
}

/**
 * Coupon rules (contract "Offers"): active + within dates + under usageLimit +
 * under perUserLimit + subtotal ≥ minOrderAmount. Discounts apply to the
 * subtotal, never to shipping.
 */
@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(Coupon) private readonly coupons: Repository<Coupon>,
  ) {}

  /**
   * Pass the checkout transaction's manager with `lock: true` so two orders
   * cannot both take the last use of a limited coupon.
   */
  async evaluate(
    rawCode: string,
    userId: string,
    subtotal: number,
    m: EntityManager = this.coupons.manager,
    lock = false,
    now = new Date(),
  ): Promise<CouponResult> {
    const code = rawCode.trim().toUpperCase();
    const qb = m
      .getRepository(Coupon)
      .createQueryBuilder('c')
      .where('c.code = :code', { code });
    if (lock) qb.setLock('pessimistic_write');
    const coupon = await qb.getOne();

    const invalid = (message: string): CouponResult => ({
      code,
      valid: false,
      message,
      discount: 0,
      coupon,
    });

    // SEC-11: unknown, switched off and not-yet-started codes look the same,
    // so nobody can probe for coupons that are scheduled but not announced
    if (!coupon || !coupon.isActive || now < coupon.startsAt)
      return invalid('This coupon code is not valid');
    if (now >= coupon.expiresAt) return invalid('This coupon has expired');
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return invalid('This coupon has been fully used');
    }
    if (coupon.perUserLimit !== null) {
      const used = await m.count(CouponUsage, {
        where: { couponId: coupon.id, userId },
      });
      if (used >= coupon.perUserLimit) {
        return invalid(
          coupon.perUserLimit === 1
            ? 'You have already used this coupon'
            : `This coupon can be used ${coupon.perUserLimit} times per customer`,
        );
      }
    }
    if (subtotal <= 0)
      return invalid('Add items to your cart to use this coupon');
    if (coupon.minOrderAmount !== null && subtotal < coupon.minOrderAmount) {
      return invalid(
        `Spend ${taka(money(coupon.minOrderAmount - subtotal))} more to use this coupon (minimum ${taka(coupon.minOrderAmount)})`,
      );
    }

    const discount = computeDiscount(coupon, subtotal);
    return {
      code,
      valid: true,
      message: `Coupon applied: you save ${taka(discount)}`,
      discount,
      coupon,
    };
  }

  /** Inside the checkout transaction. */
  async recordUsage(
    m: EntityManager,
    couponId: string,
    userId: string,
    orderId: string,
  ) {
    await m.insert(CouponUsage, { couponId, userId, orderId });
    await m.increment(Coupon, { id: couponId }, 'usedCount', 1);
  }

  /** Cancel/return: give the use back (idempotent). */
  async releaseUsage(m: EntityManager, orderId: string) {
    const usage = await m.findOne(CouponUsage, { where: { orderId } });
    if (!usage) return;
    await m.delete(CouponUsage, { id: usage.id });
    await m
      .createQueryBuilder()
      .update(Coupon)
      .set({ usedCount: () => 'GREATEST("usedCount" - 1, 0)' })
      .where('id = :id', { id: usage.couponId })
      .execute();
  }
}
