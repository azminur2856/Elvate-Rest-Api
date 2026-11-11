import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductImage } from './entities/product-image.entity';
import { FlashSale } from 'src/offers/entities/flash-sale.entity';
import { CategoriesService, Crumb } from 'src/categories/categories.service';
import {
  effectivePriceSql,
  LiveFlashSale,
  liveFlashSaleJoin,
  priceOf,
  PricingService,
} from 'src/pricing/pricing.service';
import { Paginated, pageParams, paginated } from 'src/common/pagination';
import { ProductListQueryDto } from './dto/product-query.dto';
import { AuthUser } from 'src/common/auth-user';
import { SHOP_MANAGER_ROLES } from 'src/users/enums/role.enum';

// ---------- response shapes (contract "Shared types") ----------

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  price: number;
  effectivePrice: number;
  discountPercent: number;
  mainImage: string | null;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  isOnSale: boolean;
  category: { id: string; name: string; slug: string };
  flashSaleEndsAt: Date | null;
};

export type ProductVariantView = {
  id: string;
  size: string | null;
  color: string | null;
  sku: string;
  stock: number;
  price: number;
  effectivePrice: number;
};

export type ProductImageView = {
  id: string;
  url: string;
  isMain: boolean;
  sortOrder: number;
};

export type ProductDetail = ProductCard & {
  description: string;
  material: string | null;
  careInstructions: string | null;
  specifications: Record<string, string>;
  images: ProductImageView[];
  variants: ProductVariantView[];
  breadcrumb: Crumb[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const isShopManager = (user?: AuthUser | null) =>
  !!user && (SHOP_MANAGER_ROLES as readonly string[]).includes(user.role);

/** Clothing sizes in shop order; numeric sizes next; anything else alphabetical. */
const SIZE_ORDER = [
  'XXS',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  '2XL',
  '3XL',
  '4XL',
  '5XL',
];
export function compareSizes(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const ia = SIZE_ORDER.indexOf(a.toUpperCase());
  const ib = SIZE_ORDER.indexOf(b.toUpperCase());
  if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  const na = Number.parseFloat(a);
  const nb = Number.parseFloat(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  if (!Number.isNaN(na)) return -1;
  if (!Number.isNaN(nb)) return 1;
  return a.localeCompare(b);
}

/** Escape LIKE wildcards so a search for "50%" means the text "50%". */
const likePattern = (q: string) =>
  `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    @InjectRepository(ProductImage)
    private readonly images: Repository<ProductImage>,
    private readonly categories: CategoriesService,
    private readonly pricing: PricingService,
  ) {}

  // ---------- GET /products ----------

  async list(query: ProductListQueryDto): Promise<Paginated<ProductCard>> {
    const { page, pageSize, skip, take } = pageParams(query, 12);
    const qb = this.baseQuery(new Date()).where('p.isActive = true');

    if (query.category) {
      const ids = await this.categories.scopeIds(query.category);
      if (!ids) return paginated([], 0, page, pageSize);
      qb.andWhere('p.categoryId IN (:...categoryIds)', { categoryIds: ids });
    }
    if (query.q?.trim()) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('p.name ILIKE :like')
            .orWhere('p.brand ILIKE :like')
            .orWhere('p.description ILIKE :like'),
        ),
        { like: likePattern(query.q) },
      );
    }
    if (query.minPrice !== undefined) {
      qb.andWhere(`${effectivePriceSql} >= :minPrice`, {
        minPrice: query.minPrice,
      });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere(`${effectivePriceSql} <= :maxPrice`, {
        maxPrice: query.maxPrice,
      });
    }
    if (query.sizes?.length) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM product_variant v WHERE v."productId" = p.id AND LOWER(v.size) IN (:...sizes))',
        { sizes: query.sizes.map((s) => s.toLowerCase()) },
      );
    }
    if (query.colors?.length) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM product_variant v WHERE v."productId" = p.id AND LOWER(v.color) IN (:...colors))',
        { colors: query.colors.map((c) => c.toLowerCase()) },
      );
    }
    if (query.brand?.length) {
      qb.andWhere('LOWER(p.brand) IN (:...brands)', {
        brands: query.brand.map((b) => b.toLowerCase()),
      });
    }
    if (query.onSale !== undefined) {
      qb.andWhere(`${effectivePriceSql} ${query.onSale ? '<' : '>='} p.price`);
    }
    if (query.featured !== undefined) {
      qb.andWhere('p.isFeatured = :featured', { featured: query.featured });
    }
    if (query.newArrival !== undefined) {
      qb.andWhere('p.isNewArrival = :newArrival', {
        newArrival: query.newArrival,
      });
    }
    if (query.inStock !== undefined) {
      qb.andWhere(
        `${query.inStock ? '' : 'NOT '}EXISTS (SELECT 1 FROM product_variant v WHERE v."productId" = p.id AND v.stock > 0)`,
      );
    }

    const total = await qb.getCount();
    this.applySort(qb, query.sort ?? 'newest');
    const rows = await qb
      .select('p.id', 'id')
      .addSelect(`${effectivePriceSql}`, 'eff')
      .offset(skip)
      .limit(take)
      .getRawMany<{ id: string }>();

    const items = await this.cards(rows.map((r) => r.id));
    return paginated(items, total, page, pageSize);
  }

  // ---------- GET /products/filters ----------

  async filters(category?: string) {
    const empty = {
      sizes: [],
      colors: [],
      brands: [],
      minPrice: 0,
      maxPrice: 0,
    };
    let categoryIds: string[] | null = null;
    if (category) {
      categoryIds = await this.categories.scopeIds(category);
      if (!categoryIds) return empty;
    }
    const scope = (qb: SelectQueryBuilder<Product>) => {
      qb.where('p.isActive = true');
      if (categoryIds)
        qb.andWhere('p.categoryId IN (:...categoryIds)', { categoryIds });
      return qb;
    };

    const variantValues = (column: 'size' | 'color') =>
      scope(this.products.createQueryBuilder('p'))
        .innerJoin(ProductVariant, 'v', 'v."productId" = p.id')
        .andWhere(`v.${column} IS NOT NULL`)
        .select(`DISTINCT v.${column}`, 'value')
        .getRawMany<{ value: string }>();

    const [sizes, colors, brands, range] = await Promise.all([
      variantValues('size'),
      variantValues('color'),
      scope(this.products.createQueryBuilder('p'))
        .andWhere('p.brand IS NOT NULL')
        .select('DISTINCT p.brand', 'value')
        .getRawMany<{ value: string }>(),
      scope(this.baseQuery(new Date()))
        .select(`MIN(${effectivePriceSql})`, 'min')
        .addSelect(`MAX(${effectivePriceSql})`, 'max')
        .getRawOne<{ min: string | null; max: string | null }>(),
    ]);

    const uniq = (rows: { value: string }[]) => [
      ...new Map(rows.map((r) => [r.value.toLowerCase(), r.value])).values(),
    ];
    return {
      sizes: uniq(sizes).sort(compareSizes),
      colors: uniq(colors).sort((a, b) => a.localeCompare(b)),
      brands: uniq(brands).sort((a, b) => a.localeCompare(b)),
      minPrice: Number(range?.min ?? 0),
      maxPrice: Number(range?.max ?? 0),
    };
  }

  // ---------- GET /products/:slug ----------

  async detailBySlug(
    slug: string,
    viewer?: AuthUser | null,
  ): Promise<ProductDetail> {
    const product = await this.products.findOne({
      where: { slug },
      relations: { category: true },
    });
    const manager = isShopManager(viewer);
    if (!product || (!product.isActive && !manager)) {
      throw new NotFoundException('Product not found');
    }
    if (product.isActive && !manager) {
      await this.products.increment({ id: product.id }, 'viewCount', 1);
      product.viewCount += 1;
    }
    return this.detail(product);
  }

  /** Detail by id regardless of status (admin). */
  async detailById(id: string): Promise<ProductDetail> {
    const product = await this.products.findOne({
      where: { id },
      relations: { category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.detail(product);
  }

  // ---------- GET /products/:slug/related ----------

  async related(slug: string, limit = 8): Promise<ProductCard[]> {
    const product = await this.products.findOne({
      where: { slug, isActive: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const pick = (categoryIds: string[], exclude: string[], take: number) =>
      take <= 0
        ? Promise.resolve([] as { id: string }[])
        : this.products.find({
            select: ['id'],
            where: {
              isActive: true,
              categoryId: In(categoryIds),
              id: Not(In(exclude)),
            },
            order: { soldCount: 'DESC', createdAt: 'DESC' },
            take,
          });

    const same = await pick([product.categoryId], [product.id], limit);
    let ids = same.map((p) => p.id);
    if (ids.length < limit) {
      const rootSlug = (await this.categories.breadcrumb(product.categoryId))[0]
        ?.slug;
      const rootScope = rootSlug
        ? await this.categories.scopeIds(rootSlug)
        : null;
      if (rootScope) {
        const more = await pick(
          rootScope,
          [product.id, ...ids],
          limit - ids.length,
        );
        ids = ids.concat(more.map((p) => p.id));
      }
    }
    return this.cards(ids);
  }

  // ---------- builders (shared with admin, cart, orders) ----------

  /** Cards for these product ids, in the same order. */
  async cards(ids: string[]): Promise<ProductCard[]> {
    if (ids.length === 0) return [];
    const [products, stockRows, mainImages, flash] = await Promise.all([
      this.products.find({
        where: { id: In(ids) },
        relations: { category: true },
      }),
      this.variants
        .createQueryBuilder('v')
        .select('v.productId', 'productId')
        .addSelect('BOOL_OR(v.stock > 0)', 'inStock')
        .where('v.productId IN (:...ids)', { ids })
        .groupBy('v.productId')
        .getRawMany<{ productId: string; inStock: boolean }>(),
      this.images.find({
        where: { productId: In(ids) },
        order: { isMain: 'DESC', sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      this.pricing.liveFlashSales(ids),
    ]);

    const inStock = new Map(stockRows.map((r) => [r.productId, r.inStock]));
    const image = new Map<string, string>();
    for (const img of mainImages)
      if (!image.has(img.productId)) image.set(img.productId, img.url);
    const byId = new Map(products.map((p) => [p.id, p]));

    return ids
      .map((id) => byId.get(id))
      .filter((p): p is Product => !!p)
      .map((p) =>
        this.card(
          p,
          flash.get(p.id) ?? null,
          image.get(p.id) ?? null,
          inStock.get(p.id) ?? false,
        ),
      );
  }

  card(
    p: Product,
    flash: LiveFlashSale | null,
    mainImage: string | null,
    inStock: boolean,
  ): ProductCard {
    const priced = priceOf(p, null, flash);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      price: priced.price,
      effectivePrice: priced.effectivePrice,
      discountPercent: priced.discountPercent,
      mainImage,
      rating: p.ratingAvg,
      reviewCount: p.reviewCount,
      inStock,
      isFeatured: p.isFeatured,
      isNewArrival: p.isNewArrival,
      isOnSale: priced.isOnSale,
      category: {
        id: p.category.id,
        name: p.category.name,
        slug: p.category.slug,
      },
      flashSaleEndsAt: priced.flashSaleEndsAt,
    };
  }

  async imagesOf(productId: string): Promise<ProductImageView[]> {
    const rows = await this.images.find({
      where: { productId },
      order: { isMain: 'DESC', sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((i) => ({
      id: i.id,
      url: i.url,
      isMain: i.isMain,
      sortOrder: i.sortOrder,
    }));
  }

  variantView(
    p: Product,
    v: ProductVariant,
    flash: LiveFlashSale | null,
  ): ProductVariantView {
    const priced = priceOf(p, v, flash);
    return {
      id: v.id,
      size: v.size,
      color: v.color,
      sku: v.sku,
      stock: v.stock,
      price: priced.price,
      effectivePrice: priced.effectivePrice,
    };
  }

  private async detail(product: Product): Promise<ProductDetail> {
    const [variants, images, flash, breadcrumb] = await Promise.all([
      this.variants.find({ where: { productId: product.id } }),
      this.imagesOf(product.id),
      this.pricing.liveFlashSales([product.id]),
      this.categories.breadcrumb(product.categoryId),
    ]);
    const live = flash.get(product.id) ?? null;
    variants.sort(
      (a, b) =>
        compareSizes(a.size, b.size) ||
        (a.color ?? '').localeCompare(b.color ?? ''),
    );

    return {
      ...this.card(
        product,
        live,
        images[0]?.url ?? null,
        variants.some((v) => v.stock > 0),
      ),
      description: product.description,
      material: product.material,
      careInstructions: product.careInstructions,
      specifications: product.specifications ?? {},
      images,
      variants: variants.map((v) => this.variantView(product, v, live)),
      breadcrumb,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /** product `p` LEFT JOIN its live flash sale `fs` (for effectivePriceSql). */
  private baseQuery(now: Date) {
    return this.products
      .createQueryBuilder('p')
      .leftJoin(FlashSale, 'fs', liveFlashSaleJoin, { now });
  }

  private applySort(qb: SelectQueryBuilder<Product>, sort: string) {
    switch (sort) {
      case 'price_asc':
        qb.orderBy(effectivePriceSql, 'ASC');
        break;
      case 'price_desc':
        qb.orderBy(effectivePriceSql, 'DESC');
        break;
      case 'popular':
        qb.orderBy('p.soldCount', 'DESC').addOrderBy('p.viewCount', 'DESC');
        break;
      case 'rating':
        qb.orderBy('p.ratingAvg', 'DESC').addOrderBy('p.reviewCount', 'DESC');
        break;
      default:
        qb.orderBy('p.createdAt', 'DESC');
    }
    qb.addOrderBy('p.id', 'ASC');
  }
}
