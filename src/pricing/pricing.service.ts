import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { FlashSale } from 'src/offers/entities/flash-sale.entity';
import { money } from 'src/common/decimal.transformer';

export type PricedProduct = { price: number; salePrice: number | null };
export type PricedVariant = { price: number | null } | null;
export type LiveFlashSale = { discountPercent: number; endsAt: Date };

export type PriceBreakdown = {
  /** Regular price of this product/variant (variant override or product price). */
  price: number;
  /** What the customer pays: flash sale > salePrice > price. */
  effectivePrice: number;
  /** 0 when not discounted, else rounded percent off `price`. */
  discountPercent: number;
  isOnSale: boolean;
  /** Set while a flash sale applies. */
  flashSaleEndsAt: Date | null;
};

/**
 * THE price rule, used by the catalog, cart, quote and orders (BE-11):
 *
 *   regular   = variant.price ?? product.price
 *   flash     = round(regular × (100 − flash.discountPercent) / 100)   (whole taka)
 *   sale      = product.salePrice when the variant has no override, else
 *               round(regular × salePrice / product.price)  (same % off)
 *   effective = flash if a flash sale is live, else sale if salePrice < price,
 *               else regular
 *
 * `effectivePriceSql` below is the same rule for product-level prices in SQL
 * (catalog price filters and sorting). Keep the two in sync; the unit tests
 * pin both.
 */
export function priceOf(
  product: PricedProduct,
  variant: PricedVariant,
  flash: LiveFlashSale | null,
): PriceBreakdown {
  const regular = money(variant?.price ?? product.price);
  let effective = regular;
  let flashSaleEndsAt: Date | null = null;

  if (flash) {
    effective = Math.round((regular * (100 - flash.discountPercent)) / 100);
    flashSaleEndsAt = flash.endsAt;
  } else if (
    product.salePrice !== null &&
    product.salePrice < product.price &&
    product.price > 0
  ) {
    effective =
      variant?.price == null
        ? money(product.salePrice)
        : Math.round((regular * product.salePrice) / product.price);
  }

  effective = Math.min(regular, Math.max(0, effective));
  const discountPercent =
    regular > 0 && effective < regular
      ? Math.round(((regular - effective) / regular) * 100)
      : 0;

  return {
    price: regular,
    effectivePrice: effective,
    discountPercent,
    isOnSale: effective < regular,
    flashSaleEndsAt,
  };
}

/**
 * SQL for the product-level effective price. `p` = product alias, `fs` = a
 * LEFT JOIN of the live flash sale (see `joinLiveFlashSale`).
 */
export const effectivePriceSql = `(CASE
  WHEN fs.id IS NOT NULL THEN ROUND(p.price * (100 - fs."discountPercent") / 100.0)
  WHEN p."salePrice" IS NOT NULL AND p."salePrice" < p.price THEN p."salePrice"
  ELSE p.price END)`;

/** Join condition for the flash sale that is live at `:now` (at most one per product). */
export const liveFlashSaleJoin =
  'fs."productId" = p.id AND fs."isActive" = true AND fs."startsAt" <= :now AND fs."endsAt" > :now';

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(FlashSale)
    private readonly flashSales: Repository<FlashSale>,
  ) {}

  priceOf = priceOf;

  /** Convenience wrapper matching the plan's `effectivePrice(product, variant, ...)`. */
  effectivePrice(
    product: PricedProduct,
    variant: PricedVariant,
    flash: LiveFlashSale | null,
  ): number {
    return priceOf(product, variant, flash).effectivePrice;
  }

  /** Live flash sale per product id at `now`. */
  async liveFlashSales(
    productIds: string[],
    now = new Date(),
  ): Promise<Map<string, LiveFlashSale>> {
    const map = new Map<string, LiveFlashSale>();
    if (productIds.length === 0) return map;
    const rows = await this.flashSales.find({
      where: {
        productId: In([...new Set(productIds)]),
        isActive: true,
        startsAt: LessThanOrEqual(now),
        endsAt: MoreThan(now),
      },
      order: { startsAt: 'ASC' },
    });
    for (const r of rows) {
      if (!map.has(r.productId)) {
        map.set(r.productId, {
          discountPercent: r.discountPercent,
          endsAt: r.endsAt,
        });
      }
    }
    return map;
  }
}
