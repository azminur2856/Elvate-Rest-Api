import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, IsNull, Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { ReviewStatus } from './enums/review-status.enum';
import { AdminReviewsQueryDto, CreateReviewDto } from './dto/review.dto';
import { Product } from 'src/products/entities/product.entity';
import { ProductImage } from 'src/products/entities/product-image.entity';
import { Users } from 'src/users/entities/users.entity';
import { Role, SHOP_MANAGER_ROLES } from 'src/users/enums/role.enum';
import { OrderStatus } from 'src/orders/order.enums';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { actorLabel, AuthUser } from 'src/common/auth-user';
import {
  Paginated,
  PaginationQueryDto,
  pageParams,
  paginated,
} from 'src/common/pagination';
import { publicAvatarUrl, toImgPath } from 'src/common/media';

/** Contract `Review`. */
export type ReviewView = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  status: ReviewStatus;
  user: { name: string; avatar: string | null } | null;
  product?: { id: string; name: string; slug: string; image: string | null };
};

type NameStyle = 'public' | 'full';

/** Public pages show "Rahim K."; the owner and moderators see the full name. */
export function displayName(u: Users, style: NameStyle) {
  const first = (u.firstName ?? '').trim();
  const last = (u.lastName ?? '').trim();
  if (style === 'full') return `${first} ${last}`.trim() || 'Customer';
  return (
    [first, last ? `${last[0].toUpperCase()}.` : '']
      .filter(Boolean)
      .join(' ') || 'Customer'
  );
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly images: Repository<ProductImage>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  // ---------- public ----------

  /** APPROVED reviews of an active product, with average / count / distribution. */
  async forProduct(slug: string, query: PaginationQueryDto) {
    const product = await this.products.findOne({
      where: { slug, isActive: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const { page, pageSize, skip, take } = pageParams(query, 10);

    const where = {
      productId: product.id,
      reviewStatus: ReviewStatus.APPROVED,
    };
    const [[rows, total], dist] = await Promise.all([
      this.reviews.findAndCount({
        where,
        relations: { user: true },
        order: { createdAt: 'DESC' },
        skip,
        take,
      }),
      this.reviews
        .createQueryBuilder('r')
        .select('r.rating', 'rating')
        .addSelect('COUNT(*)', 'count')
        .where('r.productId = :pid AND r.reviewStatus = :approved', {
          pid: product.id,
          approved: ReviewStatus.APPROVED,
        })
        .groupBy('r.rating')
        .getRawMany<{ rating: number; count: string }>(),
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<
      1 | 2 | 3 | 4 | 5,
      number
    >;
    let sum = 0;
    let count = 0;
    for (const d of dist) {
      const r = Number(d.rating) as 1 | 2 | 3 | 4 | 5;
      distribution[r] = Number(d.count);
      sum += r * Number(d.count);
      count += Number(d.count);
    }
    return {
      ...paginated(
        rows.map((r) => this.view(r, 'public')),
        total,
        page,
        pageSize,
      ),
      average: count ? Math.round((sum / count) * 100) / 100 : 0,
      count,
      distribution,
    };
  }

  async featured(limit = 10): Promise<ReviewView[]> {
    const rows = await this.reviews
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .innerJoinAndSelect('r.product', 'p')
      .where('r.reviewStatus = :approved', { approved: ReviewStatus.APPROVED })
      .andWhere('r.rating >= 4')
      .andWhere("COALESCE(TRIM(r.comment), '') <> ''")
      .andWhere('p.isActive = true')
      .orderBy('r.createdAt', 'DESC')
      .take(limit)
      .getMany();
    return this.withProducts(rows, 'public');
  }

  // ---------- customer ----------

  async eligibility(
    userId: string,
    slug: string,
  ): Promise<{ canReview: boolean; reason: string | null }> {
    const product = await this.products.findOne({
      where: { slug, isActive: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const reason = await this.whyNot(userId, product.id);
    return { canReview: reason === null, reason };
  }

  async create(
    user: AuthUser,
    productId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewView> {
    const product = await this.products.findOne({
      where: { id: productId, isActive: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const reason = await this.whyNot(user.id, productId);
    if (reason) {
      throw reason.startsWith('You already')
        ? new ConflictException(reason)
        : new ForbiddenException(reason);
    }

    let saved: Review;
    try {
      saved = await this.reviews.save(
        this.reviews.create({
          rating: dto.rating,
          comment: dto.comment || null,
          reviewStatus: ReviewStatus.PENDING,
          user: { id: user.id } as Users,
          productId,
        }),
      );
    } catch (err) {
      if (
        (err as { code?: string })?.code === '23505' ||
        (err as { driverError?: { code?: string } })?.driverError?.code ===
          '23505'
      ) {
        throw new ConflictException('You already reviewed this product');
      }
      throw err;
    }
    await this.log(
      user,
      ActivityType.REVIEW_ADD,
      `User ${user.id} reviewed product ${product.slug} (${dto.rating}★, review ${saved.id})`,
    );
    const full = await this.reviews.findOne({
      where: { id: saved.id },
      relations: { user: true, product: true },
    });
    return (await this.withProducts([full!], 'full'))[0];
  }

  async mine(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<ReviewView>> {
    const { page, pageSize, skip, take } = pageParams(query, 10);
    const [rows, total] = await this.reviews.findAndCount({
      where: { user: { id: userId }, productId: Not(IsNull()) },
      relations: { user: true, product: true },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return paginated(
      await this.withProducts(rows, 'full'),
      total,
      page,
      pageSize,
    );
  }

  /** Owner or ADMIN. Removing an approved review updates the product rating. */
  async remove(actor: AuthUser, id: number): Promise<{ success: true }> {
    const review = await this.reviews.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    const isOwner = review.user?.id === actor.id;
    if (!isOwner && actor.role !== Role.ADMIN)
      throw new NotFoundException('Review not found');

    await this.reviews.delete(id);
    if (review.productId && review.reviewStatus === ReviewStatus.APPROVED) {
      await this.recomputeRating(review.productId);
    }
    await this.log(
      actor,
      ActivityType.REVIEW_DELETE,
      `${actorLabel(actor)} deleted review ${id}`,
    );
    return { success: true };
  }

  // ---------- moderation (ADMIN · STAFF) ----------

  async adminList(query: AdminReviewsQueryDto): Promise<Paginated<ReviewView>> {
    const { page, pageSize, skip, take } = pageParams(query, 10);
    const [rows, total] = await this.reviews.findAndCount({
      where: {
        productId: Not(IsNull()),
        ...(query.status ? { reviewStatus: query.status } : {}),
      },
      relations: { user: true, product: true },
      // oldest pending first is the natural moderation queue
      order: {
        createdAt: query.status === ReviewStatus.PENDING ? 'ASC' : 'DESC',
      },
      skip,
      take,
    });
    return paginated(
      await this.withProducts(rows, 'full'),
      total,
      page,
      pageSize,
    );
  }

  async moderate(
    actor: AuthUser,
    id: number,
    status: ReviewStatus.APPROVED | ReviewStatus.REJECTED,
  ): Promise<ReviewView> {
    if (!(SHOP_MANAGER_ROLES as readonly string[]).includes(actor.role))
      throw new ForbiddenException();
    const review = await this.reviews.findOne({
      where: { id },
      relations: { user: true, product: true },
    });
    if (!review || !review.productId)
      throw new NotFoundException('Review not found');
    if (review.reviewStatus !== status) {
      await this.reviews.update(id, { reviewStatus: status });
      review.reviewStatus = status;
      await this.recomputeRating(review.productId);
      await this.log(
        actor,
        ActivityType.ADMIN_REVIEW_MODERATE,
        `${actorLabel(actor)} ${status === ReviewStatus.APPROVED ? 'approved' : 'rejected'} review ${id}`,
      );
    }
    return (await this.withProducts([review], 'full'))[0];
  }

  // ---------- used by orders (canReview) ----------

  /** Product ids (of these) that the user has already reviewed. */
  async reviewedProductIds(
    userId: string,
    productIds: string[],
  ): Promise<Set<string>> {
    if (!productIds.length) return new Set();
    const rows = await this.reviews.find({
      select: { productId: true },
      where: { user: { id: userId }, productId: In(productIds) },
    });
    return new Set(rows.map((r) => r.productId!));
  }

  // ---------- helpers ----------

  /** null = may review; otherwise the reason shown to the customer. */
  private async whyNot(
    userId: string,
    productId: string,
  ): Promise<string | null> {
    const already = await this.reviews.exists({
      where: { user: { id: userId }, productId },
    });
    if (already) return 'You already reviewed this product';
    const [{ bought }] = await this.dataSource.query<{ bought: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1 FROM order_item i JOIN orders o ON o.id = i."orderId"
          WHERE o."userId" = $1 AND o.status = $2 AND i."productId" = $3
       ) AS bought`,
      [userId, OrderStatus.DELIVERED, productId],
    );
    return bought
      ? null
      : 'You can review this product once an order with it has been delivered to you';
  }

  /** ratingAvg + reviewCount from APPROVED reviews. */
  private async recomputeRating(productId: string) {
    const agg = await this.reviews
      .createQueryBuilder('r')
      .select('COALESCE(AVG(r.rating), 0)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('r.productId = :pid AND r.reviewStatus = :approved', {
        pid: productId,
        approved: ReviewStatus.APPROVED,
      })
      .getRawOne<{ avg: string; count: string }>();
    await this.products.update(productId, {
      ratingAvg: Math.round(Number(agg?.avg ?? 0) * 100) / 100,
      reviewCount: Number(agg?.count ?? 0),
    });
  }

  private view(r: Review, style: NameStyle): ReviewView {
    return {
      id: String(r.id),
      rating: r.rating,
      comment: r.comment ?? null,
      createdAt: r.createdAt,
      status: r.reviewStatus,
      user: r.user
        ? { name: displayName(r.user, style), avatar: publicAvatarUrl(r.user) }
        : null,
    };
  }

  private async withProducts(
    rows: Review[],
    style: NameStyle,
  ): Promise<ReviewView[]> {
    const productIds = [
      ...new Set(rows.map((r) => r.productId).filter((x): x is string => !!x)),
    ];
    const imgs = productIds.length
      ? await this.images.find({
          where: { productId: In(productIds) },
          order: { isMain: 'DESC', sortOrder: 'ASC' },
        })
      : [];
    const image = new Map<string, string>();
    for (const i of imgs)
      if (!image.has(i.productId)) image.set(i.productId, i.url);
    return rows.map((r) => ({
      ...this.view(r, style),
      ...(r.product
        ? {
            product: {
              id: r.product.id,
              name: r.product.name,
              slug: r.product.slug,
              image: toImgPath(image.get(r.product.id)), // BE-28
            },
          }
        : {}),
    }));
  }

  private log(actor: AuthUser, activity: ActivityType, description: string) {
    return this.activityLogs.createActivityLog({
      activity,
      description,
      user: { id: actor.id } as Users,
    });
  }
}
