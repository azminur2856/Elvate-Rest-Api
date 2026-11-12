import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WishlistItem } from './wishlist.entity';
import { Product } from 'src/products/entities/product.entity';
import { CatalogService, ProductCard } from 'src/products/catalog.service';
import {
  Paginated,
  PaginationQueryDto,
  pageParams,
  paginated,
} from 'src/common/pagination';

export const MAX_WISHLIST = 200;

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(WishlistItem)
    private readonly items: Repository<WishlistItem>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly catalog: CatalogService,
  ) {}

  /** Saved products that are still for sale, newest first. */
  async list(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<ProductCard & { addedAt: Date }>> {
    const { page, pageSize, skip, take } = pageParams(query, 12);
    const [rows, total] = await this.items
      .createQueryBuilder('w')
      .innerJoin('w.product', 'p', 'p.isActive = true')
      .where('w.userId = :userId', { userId })
      .orderBy('w.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    const cards = await this.catalog.cards(rows.map((r) => r.productId));
    const added = new Map(rows.map((r) => [r.productId, r.createdAt]));
    return paginated(
      cards.map((c) => ({ ...c, addedAt: added.get(c.id)! })),
      total,
      page,
      pageSize,
    );
  }

  /** Product ids only, for the heart icons on product cards. */
  async ids(userId: string): Promise<string[]> {
    const rows = await this.items.find({
      select: ['productId'],
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => r.productId);
  }

  /** Idempotent: saving a saved product changes nothing. */
  async add(
    userId: string,
    productId: string,
  ): Promise<{ success: true; count: number }> {
    if (
      !(await this.products.exists({
        where: { id: productId, isActive: true },
      }))
    ) {
      throw new NotFoundException('Product not found');
    }
    const count = await this.items.count({ where: { userId } });
    if (
      count >= MAX_WISHLIST &&
      !(await this.items.exists({ where: { userId, productId } }))
    ) {
      throw new BadRequestException(
        `A wishlist can hold up to ${MAX_WISHLIST} products`,
      );
    }
    await this.items
      .createQueryBuilder()
      .insert()
      .values({ userId, productId })
      .orIgnore()
      .execute();
    return {
      success: true,
      count: await this.items.count({ where: { userId } }),
    };
  }

  async remove(
    userId: string,
    productId: string,
  ): Promise<{ success: true; count: number }> {
    await this.items.delete({ userId, productId });
    return {
      success: true,
      count: await this.items.count({ where: { userId } }),
    };
  }
}
