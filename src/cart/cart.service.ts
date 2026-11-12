import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CartItem } from './entities/cart-item.entity';
import { ProductVariant } from 'src/products/entities/product-variant.entity';
import { ProductImage } from 'src/products/entities/product-image.entity';
import { priceOf, PricingService } from 'src/pricing/pricing.service';
import { money } from 'src/common/decimal.transformer';
import {
  AddCartItemDto,
  GuestCartDto,
  MAX_PER_LINE,
  UpdateCartItemDto,
} from './dto/cart.dto';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { Users } from 'src/users/entities/users.entity';
import { toImgPath } from 'src/common/media';

/** Contract `CartLine`. */
export type CartLine = {
  id: string | null;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  size: string | null;
  color: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  /** false = product inactive or stock < quantity (excluded from subtotal). */
  available: boolean;
};

/** Contract `CartView`. */
export type CartView = {
  items: CartLine[];
  /** Total units across all lines. */
  itemCount: number;
  /** Sum of the available lines only. */
  subtotal: number;
  currency: 'BDT';
};

type Entry = { id: string | null; variantId: string; quantity: number };

/**
 * BE-28: a cart line as the API returns it (image as an /img/ path). The
 * priced lines themselves keep the full URL: orders store it and Stripe
 * Checkout needs an absolute address.
 */
export const lineView = (l: CartLine): CartLine => ({
  ...l,
  image: toImgPath(l.image),
});

const isUniqueViolation = (err: unknown) =>
  (err as { code?: string })?.code === '23505' ||
  (err as { driverError?: { code?: string } })?.driverError?.code === '23505';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    @InjectRepository(ProductImage)
    private readonly images: Repository<ProductImage>,
    private readonly pricing: PricingService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  // ---------- pricing core (also used by order quotes) ----------

  /**
   * Re-prices lines from the DB right now. Lines whose variant no longer
   * exists are dropped; inactive products / short stock stay in the list
   * with `available: false`.
   */
  async priceLines(entries: Entry[], now = new Date()): Promise<CartLine[]> {
    if (entries.length === 0) return [];
    const variants = await this.variants.find({
      where: { id: In([...new Set(entries.map((e) => e.variantId))]) },
      relations: { product: true },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    const productIds = [...new Set(variants.map((v) => v.productId))];

    const [images, flash] = await Promise.all([
      productIds.length
        ? this.images.find({
            where: { productId: In(productIds) },
            order: { isMain: 'DESC', sortOrder: 'ASC', createdAt: 'ASC' },
          })
        : Promise.resolve([] as ProductImage[]),
      this.pricing.liveFlashSales(productIds, now),
    ]);
    const image = new Map<string, string>();
    for (const img of images)
      if (!image.has(img.productId)) image.set(img.productId, img.url);

    const lines: CartLine[] = [];
    for (const e of entries) {
      const v = byId.get(e.variantId);
      if (!v) continue;
      const p = v.product;
      const unitPrice = priceOf(p, v, flash.get(p.id) ?? null).effectivePrice;
      lines.push({
        id: e.id,
        variantId: v.id,
        productId: p.id,
        slug: p.slug,
        name: p.name,
        image: image.get(p.id) ?? null,
        size: v.size,
        color: v.color,
        unitPrice,
        quantity: e.quantity,
        lineTotal: money(unitPrice * e.quantity),
        stock: v.stock,
        available: p.isActive && e.quantity > 0 && v.stock >= e.quantity,
      });
    }
    return lines;
  }

  toView(lines: CartLine[]): CartView {
    return {
      items: lines.map(lineView),
      itemCount: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: money(
        lines.filter((l) => l.available).reduce((s, l) => s + l.lineTotal, 0),
      ),
      currency: 'BDT',
    };
  }

  /** Raw cart rows of a user (oldest first), for checkout. */
  entriesOf(userId: string): Promise<CartItem[]> {
    return this.items.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  // ---------- routes ----------

  async view(userId: string): Promise<CartView> {
    const rows = await this.entriesOf(userId);
    return this.toView(
      await this.priceLines(
        rows.map((r) => ({
          id: r.id,
          variantId: r.variantId,
          quantity: r.quantity,
        })),
      ),
    );
  }

  /** Guest cart pricing (public). Duplicate variants are summed; quantities clamped to 10. */
  async preview(dto: GuestCartDto): Promise<CartView> {
    const lines = await this.priceLines(
      [...mergeGuestLines(dto).entries()].map(([variantId, quantity]) => ({
        id: null,
        variantId,
        quantity: Math.min(quantity, MAX_PER_LINE),
      })),
    );
    return this.toView(lines);
  }

  async add(userId: string, dto: AddCartItemDto): Promise<CartView> {
    const variant = await this.sellableVariant(dto.variantId);
    const existing = await this.items.findOne({
      where: { userId, variantId: dto.variantId },
    });
    const quantity = (existing?.quantity ?? 0) + dto.quantity;
    assertQuantity(quantity, variant.stock);

    if (existing) {
      await this.items.update(existing.id, { quantity });
    } else {
      try {
        await this.items.insert({ userId, variantId: dto.variantId, quantity });
      } catch (err) {
        // the same variant was added concurrently (e.g. double click)
        if (!isUniqueViolation(err)) throw err;
        await this.items.update(
          { userId, variantId: dto.variantId },
          { quantity },
        );
      }
    }
    await this.log(
      userId,
      `added ${dto.quantity} × ${variant.sku} (now ${quantity})`,
    );
    return this.view(userId);
  }

  async update(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartView> {
    const item = await this.ownItem(userId, itemId);
    if (dto.quantity === 0) {
      await this.items.delete(item.id);
      await this.log(userId, `removed item ${itemId}`);
      return this.view(userId);
    }
    const variant = await this.sellableVariant(item.variantId);
    assertQuantity(dto.quantity, variant.stock);
    await this.items.update(item.id, { quantity: dto.quantity });
    await this.log(userId, `set ${variant.sku} to ${dto.quantity}`);
    return this.view(userId);
  }

  async remove(userId: string, itemId: string): Promise<CartView> {
    const item = await this.ownItem(userId, itemId);
    await this.items.delete(item.id);
    await this.log(userId, `removed item ${itemId}`);
    return this.view(userId);
  }

  async clear(userId: string): Promise<CartView> {
    const { affected } = await this.items.delete({ userId });
    if (affected)
      await this.log(userId, `cleared the cart (${affected} line(s))`);
    return this.view(userId);
  }

  /**
   * Guest cart → account after login. Quantities are added to existing lines
   * and capped at 10 and at stock (never a 400); unknown, inactive and
   * out-of-stock variants are skipped.
   */
  async merge(userId: string, dto: GuestCartDto): Promise<CartView> {
    const guest = mergeGuestLines(dto);
    if (guest.size === 0) return this.view(userId);

    const [variants, existing] = await Promise.all([
      this.variants.find({
        where: { id: In([...guest.keys()]) },
        relations: { product: true },
      }),
      this.items.find({ where: { userId, variantId: In([...guest.keys()]) } }),
    ]);
    const current = new Map(existing.map((e) => [e.variantId, e]));

    let merged = 0;
    for (const v of variants) {
      if (!v.product.isActive) continue;
      const have = current.get(v.id);
      const quantity = Math.min(
        (have?.quantity ?? 0) + (guest.get(v.id) ?? 0),
        MAX_PER_LINE,
        v.stock,
      );
      if (quantity <= 0) continue;
      if (have) {
        if (quantity !== have.quantity)
          await this.items.update(have.id, { quantity });
      } else {
        await this.items
          .createQueryBuilder()
          .insert()
          .into(CartItem)
          .values({ userId, variantId: v.id, quantity })
          .orUpdate(['quantity'], ['userId', 'variantId'])
          .execute();
      }
      merged++;
    }
    if (merged) await this.log(userId, `merged ${merged} guest cart line(s)`);
    return this.view(userId);
  }

  // ---------- helpers ----------

  private async sellableVariant(variantId: string) {
    const variant = await this.variants.findOne({
      where: { id: variantId },
      relations: { product: true },
    });
    if (!variant) throw new NotFoundException('This item no longer exists');
    if (!variant.product.isActive) {
      throw new BadRequestException(
        `${variant.product.name} is no longer available`,
      );
    }
    return variant;
  }

  private async ownItem(userId: string, itemId: string) {
    const item = await this.items.findOne({ where: { id: itemId, userId } });
    if (!item) throw new NotFoundException('Cart item not found');
    return item;
  }

  private log(userId: string, what: string) {
    return this.activityLogs.createActivityLog({
      activity: ActivityType.CART_UPDATE,
      description: `User ${userId} ${what}`,
      user: { id: userId } as Users,
    });
  }
}

/** Over-cap requests are a 400 with a message the shopper can act on. */
export function assertQuantity(quantity: number, stock: number) {
  if (quantity > MAX_PER_LINE) {
    throw new BadRequestException(
      `You can buy at most ${MAX_PER_LINE} of the same item`,
    );
  }
  if (stock <= 0) throw new BadRequestException('This item is out of stock');
  if (quantity > stock) {
    throw new BadRequestException(`Only ${stock} left in stock`);
  }
}

/** Sum duplicate variant ids of a guest cart. */
function mergeGuestLines(dto: GuestCartDto): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of dto.items)
    map.set(l.variantId, (map.get(l.variantId) ?? 0) + l.quantity);
  return map;
}
