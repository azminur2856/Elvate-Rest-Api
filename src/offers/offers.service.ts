import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Coupon, CouponType } from './entities/coupon.entity';
import { CouponUsage } from './entities/coupon-usage.entity';
import { FlashSale } from './entities/flash-sale.entity';
import { Product } from 'src/products/entities/product.entity';
import { CatalogService, ProductCard } from 'src/products/catalog.service';
import {
  CouponQueryDto,
  CreateCouponDto,
  CreateFlashSaleDto,
  FlashSaleQueryDto,
  UpdateCouponDto,
  UpdateFlashSaleDto,
} from './dto/offers.dto';
import { Paginated, pageParams, paginated } from 'src/common/pagination';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { actorLabel, AuthUser } from 'src/common/auth-user';
import { Users } from 'src/users/entities/users.entity';

/** Contract `Coupon`. */
export type CouponView = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  startsAt: Date;
  expiresAt: Date;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  isPublic: boolean;
  isActive: boolean;
};

/** Contract `FlashSale`. */
export type FlashSaleView = {
  id: string;
  title: string | null;
  discountPercent: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  product: ProductCard;
};

const isUniqueViolation = (err: unknown) =>
  (err as { code?: string })?.code === '23505' ||
  (err as { driverError?: { code?: string } })?.driverError?.code === '23505';

const toCouponView = (c: Coupon): CouponView => ({
  id: c.id,
  code: c.code,
  description: c.description,
  type: c.type,
  value: c.value,
  minOrderAmount: c.minOrderAmount,
  maxDiscount: c.maxDiscount,
  startsAt: c.startsAt,
  expiresAt: c.expiresAt,
  usageLimit: c.usageLimit,
  perUserLimit: c.perUserLimit,
  usedCount: c.usedCount,
  isPublic: c.isPublic,
  isActive: c.isActive,
});

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Coupon) private readonly coupons: Repository<Coupon>,
    @InjectRepository(CouponUsage)
    private readonly usages: Repository<CouponUsage>,
    @InjectRepository(FlashSale)
    private readonly flashSales: Repository<FlashSale>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly catalog: CatalogService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  // ---------- GET /offers (public) ----------

  async publicOffers() {
    const now = new Date();
    const [live, coupons] = await Promise.all([
      this.flashSales
        .createQueryBuilder('fs')
        .innerJoin('fs.product', 'p')
        .where('fs.isActive = true')
        .andWhere('fs.startsAt <= :now AND fs.endsAt > :now', { now })
        .andWhere('p.isActive = true')
        .orderBy('fs.endsAt', 'ASC')
        .getMany(),
      this.coupons
        .createQueryBuilder('c')
        .where('c.isActive = true AND c.isPublic = true')
        .andWhere('c.startsAt <= :now AND c.expiresAt > :now', { now })
        .andWhere('(c.usageLimit IS NULL OR c.usedCount < c.usageLimit)')
        .orderBy('c.expiresAt', 'ASC')
        .getMany(),
    ]);
    return {
      flashSales: await this.flashSaleViews(live),
      publicCoupons: coupons.map((c) => ({
        code: c.code,
        description: c.description,
        type: c.type,
        value: c.value,
        minOrderAmount: c.minOrderAmount,
        maxDiscount: c.maxDiscount,
        expiresAt: c.expiresAt,
      })),
    };
  }

  // ---------- coupons (ADMIN) ----------

  async listCoupons(query: CouponQueryDto): Promise<Paginated<CouponView>> {
    const { page, pageSize, skip, take } = pageParams(query, 10);
    const now = new Date();
    const qb = this.coupons.createQueryBuilder('c');
    if (query.q) {
      qb.andWhere(
        new Brackets((w) =>
          w.where('c.code ILIKE :like').orWhere('c.description ILIKE :like'),
        ),
        { like: `%${query.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%` },
      );
    }
    if (query.status === 'active')
      qb.andWhere('c.isActive = true AND c.expiresAt > :now', { now });
    if (query.status === 'expired') qb.andWhere('c.expiresAt <= :now', { now });
    if (query.status === 'inactive') qb.andWhere('c.isActive = false');
    const [rows, total] = await qb
      .orderBy('c.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    return paginated(rows.map(toCouponView), total, page, pageSize);
  }

  async createCoupon(
    dto: CreateCouponDto,
    actor: AuthUser,
  ): Promise<CouponView> {
    const values = {
      code: dto.code,
      description: dto.description ?? null,
      type: dto.type,
      value: dto.value,
      minOrderAmount: dto.minOrderAmount ?? null,
      maxDiscount: dto.maxDiscount ?? null,
      startsAt: new Date(dto.startsAt),
      expiresAt: new Date(dto.expiresAt),
      usageLimit: dto.usageLimit ?? null,
      perUserLimit: dto.perUserLimit ?? null,
      isPublic: dto.isPublic ?? false,
      isActive: dto.isActive ?? true,
    };
    assertCoupon(values);
    const saved = await this.saveCoupon(this.coupons.create(values));
    await this.log(
      actor,
      ActivityType.ADMIN_ADD_COUPON,
      `${actorLabel(actor)} created coupon ${saved.code} (${saved.id})`,
    );
    return toCouponView(saved);
  }

  async updateCoupon(
    id: string,
    dto: UpdateCouponDto,
    actor: AuthUser,
  ): Promise<CouponView> {
    const coupon = await this.mustFindCoupon(id);
    const keys = [
      'code',
      'description',
      'type',
      'value',
      'minOrderAmount',
      'maxDiscount',
      'usageLimit',
      'perUserLimit',
      'isPublic',
      'isActive',
    ] as const;
    for (const k of keys) {
      if (dto[k] !== undefined)
        (coupon as unknown as Record<string, unknown>)[k] = dto[k];
    }
    if (dto.startsAt !== undefined) coupon.startsAt = new Date(dto.startsAt);
    if (dto.expiresAt !== undefined) coupon.expiresAt = new Date(dto.expiresAt);
    assertCoupon(coupon);
    const saved = await this.saveCoupon(coupon);
    await this.log(
      actor,
      ActivityType.ADMIN_UPDATE_COUPON,
      `${actorLabel(actor)} updated coupon ${saved.code} (${id})`,
    );
    return toCouponView(saved);
  }

  /** A coupon that was ever used is only switched off (orders keep their link). */
  async removeCoupon(
    id: string,
    actor: AuthUser,
  ): Promise<{ success: true; softDeleted: boolean }> {
    const coupon = await this.mustFindCoupon(id);
    const used =
      (await this.usages.exists({ where: { couponId: id } })) ||
      coupon.usedCount > 0;
    if (used) {
      await this.coupons.update(id, { isActive: false });
    } else {
      await this.coupons.delete(id);
    }
    await this.log(
      actor,
      ActivityType.ADMIN_DELETE_COUPON,
      `${actorLabel(actor)} ${used ? 'deactivated (it has been used)' : 'deleted'} coupon ${coupon.code} (${id})`,
    );
    return { success: true, softDeleted: used };
  }

  // ---------- flash sales (ADMIN) ----------

  async listFlashSales(
    query: FlashSaleQueryDto,
  ): Promise<Paginated<FlashSaleView>> {
    const { page, pageSize, skip, take } = pageParams(query, 10);
    const now = new Date();
    const qb = this.flashSales.createQueryBuilder('fs');
    if (query.status === 'live')
      qb.where(
        'fs.isActive = true AND fs.startsAt <= :now AND fs.endsAt > :now',
        { now },
      );
    if (query.status === 'scheduled')
      qb.where('fs.isActive = true AND fs.startsAt > :now', { now });
    if (query.status === 'ended')
      qb.where('(fs.endsAt <= :now OR fs.isActive = false)', { now });
    const [rows, total] = await qb
      .orderBy('fs.startsAt', query.status === 'ended' ? 'DESC' : 'ASC')
      .addOrderBy('fs.id', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    return paginated(await this.flashSaleViews(rows), total, page, pageSize);
  }

  async createFlashSale(
    dto: CreateFlashSaleDto,
    actor: AuthUser,
  ): Promise<FlashSaleView> {
    const sale = this.flashSales.create({
      productId: dto.productId,
      title: dto.title ?? null,
      discountPercent: dto.discountPercent,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      isActive: dto.isActive ?? true,
    });
    await this.assertFlashSale(sale);
    const saved = await this.flashSales.save(sale);
    await this.log(
      actor,
      ActivityType.ADMIN_ADD_FLASH_SALE,
      `${actorLabel(actor)} created a ${saved.discountPercent}% flash sale on product ${saved.productId} (${saved.id})`,
    );
    return (await this.flashSaleViews([saved]))[0];
  }

  async updateFlashSale(
    id: string,
    dto: UpdateFlashSaleDto,
    actor: AuthUser,
  ): Promise<FlashSaleView> {
    const sale = await this.mustFindSale(id);
    if (dto.productId !== undefined) sale.productId = dto.productId;
    if (dto.title !== undefined) sale.title = dto.title;
    if (dto.discountPercent !== undefined)
      sale.discountPercent = dto.discountPercent;
    if (dto.startsAt !== undefined) sale.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) sale.endsAt = new Date(dto.endsAt);
    if (dto.isActive !== undefined) sale.isActive = dto.isActive;
    await this.assertFlashSale(sale);
    const saved = await this.flashSales.save(sale);
    await this.log(
      actor,
      ActivityType.ADMIN_UPDATE_FLASH_SALE,
      `${actorLabel(actor)} updated flash sale ${id}`,
    );
    return (await this.flashSaleViews([saved]))[0];
  }

  async removeFlashSale(
    id: string,
    actor: AuthUser,
  ): Promise<{ success: true }> {
    const sale = await this.mustFindSale(id);
    await this.flashSales.delete(id);
    await this.log(
      actor,
      ActivityType.ADMIN_DELETE_FLASH_SALE,
      `${actorLabel(actor)} deleted the ${sale.discountPercent}% flash sale on product ${sale.productId} (${id})`,
    );
    return { success: true };
  }

  // ---------- helpers ----------

  private async flashSaleViews(rows: FlashSale[]): Promise<FlashSaleView[]> {
    const cards = await this.catalog.cards([
      ...new Set(rows.map((r) => r.productId)),
    ]);
    const byId = new Map(cards.map((c) => [c.id, c]));
    return rows
      .filter((r) => byId.has(r.productId))
      .map((r) => ({
        id: r.id,
        title: r.title,
        discountPercent: r.discountPercent,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        isActive: r.isActive,
        product: byId.get(r.productId)!,
      }));
  }

  /** Dates in order, product exists, no overlap with another active sale of the same product. */
  private async assertFlashSale(sale: FlashSale) {
    if (!(sale.startsAt < sale.endsAt))
      throw new BadRequestException('endsAt must be after startsAt');
    const product = await this.products.findOne({
      select: ['id', 'price', 'salePrice'],
      where: { id: sale.productId },
    });
    if (!product) throw new BadRequestException('Product not found');

    // A live flash sale replaces salePrice (PricingService), so it must be cheaper.
    if (product.salePrice !== null && product.salePrice < product.price) {
      const flashPrice = Math.round(
        (product.price * (100 - sale.discountPercent)) / 100,
      );
      if (flashPrice >= product.salePrice) {
        // smallest whole percentage that really beats the sale price (no float maths)
        let minPercent = sale.discountPercent + 1;
        while (
          minPercent < 90 &&
          Math.round((product.price * (100 - minPercent)) / 100) >=
            product.salePrice
        ) {
          minPercent++;
        }
        throw new BadRequestException(
          `A ${sale.discountPercent}% flash sale (৳${flashPrice}) is not cheaper than this product's sale price (৳${product.salePrice}); use at least ${minPercent}%`,
        );
      }
    }
    if (!sale.isActive) return;
    const qb = this.flashSales
      .createQueryBuilder('fs')
      .where('fs.productId = :pid', { pid: sale.productId })
      .andWhere('fs.isActive = true')
      .andWhere('fs.startsAt < :end AND fs.endsAt > :start', {
        start: sale.startsAt,
        end: sale.endsAt,
      });
    if (sale.id) qb.andWhere('fs.id != :id', { id: sale.id });
    const clash = await qb.getOne();
    if (clash) {
      throw new ConflictException(
        `This product already has a flash sale from ${clash.startsAt.toISOString()} to ${clash.endsAt.toISOString()}`,
      );
    }
  }

  private async saveCoupon(c: Coupon) {
    try {
      return await this.coupons.save(c);
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException(`Coupon code ${c.code} already exists`);
      throw err;
    }
  }

  private async mustFindCoupon(id: string) {
    const c = await this.coupons.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Coupon not found');
    return c;
  }

  private async mustFindSale(id: string) {
    const s = await this.flashSales.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Flash sale not found');
    return s;
  }

  private log(actor: AuthUser, activity: ActivityType, description: string) {
    return this.activityLogs.createActivityLog({
      activity,
      description,
      user: { id: actor.id } as Users,
    });
  }
}

/** Cross-field rules that class-validator cannot express. */
function assertCoupon(
  c: Pick<Coupon, 'type' | 'value' | 'startsAt' | 'expiresAt'>,
) {
  if (c.type === CouponType.PERCENT && c.value > 100) {
    throw new BadRequestException('A PERCENT coupon cannot be more than 100%');
  }
  if (!(c.startsAt < c.expiresAt))
    throw new BadRequestException('expiresAt must be after startsAt');
}
