import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductImage } from './entities/product-image.entity';
import { Category } from 'src/categories/entities/category.entity';
import { CategoriesService } from 'src/categories/categories.service';
import {
  CatalogService,
  ProductCard,
  ProductDetail,
  ProductImageView,
  ProductVariantView,
} from './catalog.service';
import { PricingService } from 'src/pricing/pricing.service';
import {
  AdminProductQueryDto,
  CreateProductDto,
  UpdateImageDto,
  UpdateProductDto,
  UpdateVariantDto,
  VariantInputDto,
} from './dto/admin-product.dto';
import { slugify, uniqueSlug } from 'src/common/slug';
import { Paginated, pageParams, paginated } from 'src/common/pagination';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { actorLabel, AuthUser } from 'src/common/auth-user';
import { Users } from 'src/users/entities/users.entity';
import { imagekit } from 'src/auth/utility/imagekit';

export type AdminProductDetail = ProductDetail & {
  salePrice: number | null;
  viewCount: number;
  soldCount: number;
  variants: (ProductVariantView & { priceOverride: number | null })[];
};

export const LOW_STOCK = 5;
export const MAX_IMAGES = 8;

export type AdminProductCard = ProductCard & {
  isActive: boolean;
  totalStock: number;
  variantCount: number;
};

const skuPart = (s: string | null | undefined) =>
  (s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** `<SLUG>-<SIZE>-<COLOR>`, empty parts skipped, max 80 chars. */
export const autoSku = (
  slug: string,
  size?: string | null,
  color?: string | null,
) =>
  [skuPart(slug), skuPart(size), skuPart(color)]
    .filter(Boolean)
    .join('-')
    .slice(0, 72);

const variantKey = (size?: string | null, color?: string | null) =>
  `${(size ?? '').toLowerCase()}|${(color ?? '').toLowerCase()}`;

const isUniqueViolation = (err: unknown) =>
  (err as { code?: string })?.code === '23505' ||
  (err as { driverError?: { code?: string } })?.driverError?.code === '23505';

@Injectable()
export class AdminProductsService {
  private readonly logger = new Logger(AdminProductsService.name);

  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    @InjectRepository(ProductImage)
    private readonly images: Repository<ProductImage>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly categories: CategoriesService,
    private readonly catalog: CatalogService,
    private readonly pricing: PricingService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  // ---------- list / detail ----------

  async list(
    query: AdminProductQueryDto,
  ): Promise<Paginated<AdminProductCard>> {
    const { page, pageSize, skip, take } = pageParams(query, 10);
    const qb = this.products.createQueryBuilder('p');

    const status = query.status ?? 'all';
    if (status !== 'all')
      qb.andWhere('p.isActive = :active', { active: status === 'active' });

    if (query.category) {
      const ids = await this.categories.scopeIds(query.category);
      if (!ids) return paginated([], 0, page, pageSize);
      qb.andWhere('p.categoryId IN (:...categoryIds)', { categoryIds: ids });
    }
    if (query.q?.trim()) {
      const like = `%${query.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('p.name ILIKE :like')
            .orWhere('p.brand ILIKE :like')
            .orWhere('p.slug ILIKE :like')
            .orWhere(
              'EXISTS (SELECT 1 FROM product_variant v WHERE v."productId" = p.id AND v.sku ILIKE :like)',
            ),
        ),
        { like },
      );
    }
    const totalStockSql =
      'COALESCE((SELECT SUM(v.stock) FROM product_variant v WHERE v."productId" = p.id), 0)';
    if (query.stock === 'out') qb.andWhere(`${totalStockSql} = 0`);
    if (query.stock === 'low') {
      qb.andWhere(`${totalStockSql} > 0`).andWhere(
        'EXISTS (SELECT 1 FROM product_variant v WHERE v."productId" = p.id AND v.stock <= :low)',
        { low: LOW_STOCK },
      );
    }

    const total = await qb.getCount();
    const rows = await qb
      .select('p.id', 'id')
      .orderBy('p.updatedAt', 'DESC')
      .addOrderBy('p.id', 'ASC')
      .offset(skip)
      .limit(take)
      .getRawMany<{ id: string }>();
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return paginated([], total, page, pageSize);

    const [cards, stock, flags] = await Promise.all([
      this.catalog.cards(ids),
      this.variants
        .createQueryBuilder('v')
        .select('v.productId', 'productId')
        .addSelect('COALESCE(SUM(v.stock), 0)', 'totalStock')
        .addSelect('COUNT(*)', 'variantCount')
        .where('v.productId IN (:...ids)', { ids })
        .groupBy('v.productId')
        .getRawMany<{
          productId: string;
          totalStock: string;
          variantCount: string;
        }>(),
      this.products.find({
        select: ['id', 'isActive'],
        where: { id: In(ids) },
      }),
    ]);
    const stockOf = new Map(stock.map((s) => [s.productId, s]));
    const activeOf = new Map(flags.map((f) => [f.id, f.isActive]));

    return paginated(
      cards.map((c) => ({
        ...c,
        isActive: activeOf.get(c.id) ?? false,
        totalStock: Number(stockOf.get(c.id)?.totalStock ?? 0),
        variantCount: Number(stockOf.get(c.id)?.variantCount ?? 0),
      })),
      total,
      page,
      pageSize,
    );
  }

  /**
   * ProductDetail plus the raw values an edit form needs: `salePrice` (hidden
   * behind effectivePrice while a flash sale runs), counters, and each
   * variant's `priceOverride` (null = uses the product price).
   */
  async detail(id: string): Promise<AdminProductDetail> {
    const [detail, raw, overrides] = await Promise.all([
      this.catalog.detailById(id),
      this.products.findOne({
        select: ['id', 'salePrice', 'viewCount', 'soldCount'],
        where: { id },
      }),
      this.variants.find({ select: ['id', 'price'], where: { productId: id } }),
    ]);
    const override = new Map(overrides.map((v) => [v.id, v.price]));
    return {
      ...detail,
      salePrice: raw?.salePrice ?? null,
      viewCount: raw?.viewCount ?? 0,
      soldCount: raw?.soldCount ?? 0,
      variants: detail.variants.map((v) => ({
        ...v,
        priceOverride: override.get(v.id) ?? null,
      })),
    };
  }

  // ---------- create / update / delete ----------

  async create(dto: CreateProductDto, actor: AuthUser): Promise<ProductDetail> {
    await this.mustFindCategory(dto.categoryId);
    this.assertSalePrice(dto.price, dto.salePrice);

    const slug = dto.slug
      ? await this.assertSlugFree(dto.slug)
      : await uniqueSlug(slugify(dto.name), (s) =>
          this.products.exists({ where: { slug: s } }),
        );

    this.assertDistinctVariants(dto.variants);
    const skus = await this.resolveSkus(slug, dto.variants);

    let saved: Product;
    try {
      saved = await this.dataSource.transaction(async (m) => {
        const product = await m.save(
          m.create(Product, {
            name: dto.name,
            slug,
            description: dto.description,
            brand: dto.brand ?? null,
            categoryId: dto.categoryId,
            price: dto.price,
            salePrice: dto.salePrice ?? null,
            material: dto.material ?? null,
            careInstructions: dto.careInstructions ?? null,
            specifications: dto.specifications ?? {},
            isActive: dto.isActive ?? true,
            isFeatured: dto.isFeatured ?? false,
            isNewArrival: dto.isNewArrival ?? false,
          }),
        );
        await m.save(
          dto.variants.map((v, i) =>
            m.create(ProductVariant, {
              productId: product.id,
              size: v.size ?? null,
              color: v.color ?? null,
              sku: skus[i],
              stock: v.stock,
              price: v.price ?? null,
            }),
          ),
        );
        return product;
      });
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException('Slug or SKU is already used');
      throw err;
    }

    await this.log(
      ActivityType.ADMIN_ADD_PRODUCT,
      `${actorLabel(actor)} created product "${saved.name}" (${saved.slug}, ${saved.id}) with ${dto.variants.length} variant(s)`,
      actor,
    );
    return this.detail(saved.id);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    actor: AuthUser,
  ): Promise<ProductDetail> {
    const product = await this.mustFindProduct(id);

    if (dto.categoryId !== undefined && dto.categoryId !== product.categoryId) {
      await this.mustFindCategory(dto.categoryId);
      product.categoryId = dto.categoryId;
    }
    if (dto.slug !== undefined && dto.slug !== product.slug) {
      product.slug = await this.assertSlugFree(dto.slug);
    }

    const fields = [
      'name',
      'description',
      'brand',
      'price',
      'salePrice',
      'material',
      'careInstructions',
      'specifications',
      'isFeatured',
      'isNewArrival',
      'isActive',
    ] as const;
    const changed: string[] = [];
    for (const f of fields) {
      if (dto[f] !== undefined) {
        (product as unknown as Record<string, unknown>)[f] = dto[f];
        changed.push(f);
      }
    }
    this.assertSalePrice(product.price, product.salePrice);

    // relation not loaded → save() writes the categoryId column
    delete (product as Partial<Product>).category;
    try {
      await this.products.save(product);
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException('Slug is already used');
      throw err;
    }

    await this.log(
      ActivityType.ADMIN_UPDATE_PRODUCT,
      `${actorLabel(actor)} updated product "${product.name}" (${product.slug}, ${id}): ${[...changed, ...(dto.slug ? ['slug'] : []), ...(dto.categoryId ? ['categoryId'] : [])].join(', ') || 'no changes'}`,
      actor,
    );
    return this.detail(id);
  }

  /** Soft delete (isActive=false) when the product was ever ordered; hard delete otherwise. */
  async remove(
    id: string,
    actor: AuthUser,
  ): Promise<{ success: true; softDeleted: boolean }> {
    const product = await this.mustFindProduct(id);

    if (await this.wasOrdered(id)) {
      await this.products.update(id, { isActive: false });
      await this.log(
        ActivityType.ADMIN_DELETE_PRODUCT,
        `${actorLabel(actor)} deactivated product "${product.name}" (${product.slug}, ${id}); it appears in orders`,
        actor,
      );
      return { success: true, softDeleted: true };
    }

    const files = await this.images.find({ where: { productId: id } });
    await this.products.delete(id); // variants, images, flash sales cascade
    await Promise.all(files.map((f) => this.deleteImageFile(f)));
    await this.log(
      ActivityType.ADMIN_DELETE_PRODUCT,
      `${actorLabel(actor)} deleted product "${product.name}" (${product.slug}, ${id})`,
      actor,
    );
    return { success: true, softDeleted: false };
  }

  // ---------- images ----------

  async addImages(
    id: string,
    files: Express.Multer.File[],
    actor: AuthUser,
  ): Promise<ProductImageView[]> {
    const product = await this.mustFindProduct(id);
    if (!files?.length)
      throw new BadRequestException(
        'Send at least one image in the "files" field',
      );

    const existing = await this.images.find({ where: { productId: id } });
    if (existing.length + files.length > MAX_IMAGES) {
      throw new BadRequestException(
        `A product can have at most ${MAX_IMAGES} images (it has ${existing.length})`,
      );
    }

    let nextOrder = existing.reduce((m, i) => Math.max(m, i.sortOrder + 1), 0);
    const hasMain = existing.some((i) => i.isMain);
    const uploaded: ProductImage[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const res = await imagekit.upload({
          file: file.buffer,
          fileName: `${product.slug}-${Date.now()}-${index}${extensionOf(file.mimetype)}`,
          folder: `/products/${id}`,
          useUniqueFileName: true,
        });
        uploaded.push(
          this.images.create({
            productId: id,
            url: res.url,
            imagekitFileId: res.fileId,
            isMain: !hasMain && index === 0,
            sortOrder: nextOrder++,
          }),
        );
      }
      await this.images.save(uploaded);
    } catch (err) {
      // do not leave orphaned files on ImageKit when a later upload or the save fails
      await Promise.all(uploaded.map((u) => this.deleteImageFile(u)));
      this.logger.error('Product image upload failed', err as Error);
      throw new BadRequestException('Image upload failed, please try again');
    }

    await this.log(
      ActivityType.ADMIN_UPDATE_PRODUCT,
      `${actorLabel(actor)} added ${files.length} image(s) to product ${product.slug} (${id})`,
      actor,
    );
    return this.catalog.imagesOf(id);
  }

  async updateImage(
    id: string,
    imageId: string,
    dto: UpdateImageDto,
    actor: AuthUser,
  ): Promise<ProductImageView[]> {
    const image = await this.mustFindImage(id, imageId);
    await this.dataSource.transaction(async (m) => {
      if (dto.isMain === true) {
        await m.update(ProductImage, { productId: id }, { isMain: false });
        await m.update(ProductImage, { id: imageId }, { isMain: true });
      } else if (dto.isMain === false && image.isMain) {
        throw new BadRequestException(
          'Pick another image as main instead of unsetting the main image',
        );
      }
      if (dto.sortOrder !== undefined)
        await m.update(
          ProductImage,
          { id: imageId },
          { sortOrder: dto.sortOrder },
        );
    });
    await this.log(
      ActivityType.ADMIN_UPDATE_PRODUCT,
      `${actorLabel(actor)} updated image ${imageId} of product ${id}`,
      actor,
    );
    return this.catalog.imagesOf(id);
  }

  async removeImage(
    id: string,
    imageId: string,
    actor: AuthUser,
  ): Promise<ProductImageView[]> {
    const image = await this.mustFindImage(id, imageId);
    await this.images.delete(imageId);
    if (image.isMain) {
      const next = await this.images.findOne({
        where: { productId: id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
      if (next) await this.images.update(next.id, { isMain: true });
    }
    await this.deleteImageFile(image);
    await this.log(
      ActivityType.ADMIN_UPDATE_PRODUCT,
      `${actorLabel(actor)} removed image ${imageId} from product ${id}`,
      actor,
    );
    return this.catalog.imagesOf(id);
  }

  // ---------- variants ----------

  async addVariant(
    id: string,
    dto: VariantInputDto,
    actor: AuthUser,
  ): Promise<ProductVariantView> {
    const product = await this.mustFindProduct(id);
    const others = await this.variants.find({ where: { productId: id } });
    this.assertDistinctVariants([...others, dto]);
    const [sku] = await this.resolveSkus(product.slug, [dto]);

    let variant: ProductVariant;
    try {
      variant = await this.variants.save(
        this.variants.create({
          productId: id,
          size: dto.size ?? null,
          color: dto.color ?? null,
          sku,
          stock: dto.stock,
          price: dto.price ?? null,
        }),
      );
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException(`SKU ${sku} is already used`);
      throw err;
    }
    await this.log(
      ActivityType.ADMIN_UPDATE_PRODUCT,
      `${actorLabel(actor)} added variant ${variant.sku} (stock ${variant.stock}) to product ${product.slug}`,
      actor,
    );
    return this.variantView(product, variant);
  }

  async updateVariant(
    variantId: string,
    dto: UpdateVariantDto,
    actor: AuthUser,
  ): Promise<ProductVariantView> {
    const variant = await this.variants.findOne({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variant not found');
    const product = await this.mustFindProduct(variant.productId);

    const next = {
      size: dto.size !== undefined ? dto.size : variant.size,
      color: dto.color !== undefined ? dto.color : variant.color,
    };
    if (dto.size !== undefined || dto.color !== undefined) {
      const others = await this.variants.find({
        where: { productId: product.id },
      });
      this.assertDistinctVariants([
        ...others.filter((o) => o.id !== variantId),
        next,
      ]);
    }
    if (dto.sku !== undefined && dto.sku !== variant.sku) {
      if (await this.variants.exists({ where: { sku: dto.sku } })) {
        throw new ConflictException(`SKU ${dto.sku} is already used`);
      }
      variant.sku = dto.sku;
    }
    const before = variant.stock;
    variant.size = next.size;
    variant.color = next.color;
    if (dto.stock !== undefined) variant.stock = dto.stock;
    if (dto.price !== undefined) variant.price = dto.price;

    try {
      await this.variants.save(variant);
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException('SKU is already used');
      throw err;
    }
    await this.log(
      ActivityType.ADMIN_UPDATE_PRODUCT,
      `${actorLabel(actor)} updated variant ${variant.sku} of product ${product.slug}${dto.stock !== undefined ? ` (stock ${before} → ${variant.stock})` : ''}`,
      actor,
    );
    return this.variantView(product, variant);
  }

  async removeVariant(
    variantId: string,
    actor: AuthUser,
  ): Promise<{ success: true }> {
    const variant = await this.variants.findOne({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variant not found');
    const count = await this.variants.count({
      where: { productId: variant.productId },
    });
    if (count <= 1) {
      throw new ConflictException(
        'A product needs at least one variant; deactivate or delete the product instead',
      );
    }
    await this.variants.delete(variantId);
    await this.log(
      ActivityType.ADMIN_UPDATE_PRODUCT,
      `${actorLabel(actor)} removed variant ${variant.sku} from product ${variant.productId}`,
      actor,
    );
    return { success: true };
  }

  // ---------- helpers ----------

  private async variantView(product: Product, variant: ProductVariant) {
    const flash = await this.pricing.liveFlashSales([product.id]);
    return this.catalog.variantView(
      product,
      variant,
      flash.get(product.id) ?? null,
    );
  }

  /** Explicit SKUs must be free; generated ones get a numeric suffix on clash. */
  private async resolveSkus(
    slug: string,
    inputs: VariantInputDto[],
  ): Promise<string[]> {
    const explicit = inputs.map((v) => v.sku).filter((s): s is string => !!s);
    if (new Set(explicit).size !== explicit.length)
      throw new BadRequestException('Duplicate SKU in the request');
    if (explicit.length) {
      const taken = await this.variants.find({
        select: ['sku'],
        where: { sku: In(explicit) },
      });
      if (taken.length)
        throw new ConflictException(
          `SKU already used: ${taken.map((t) => t.sku).join(', ')}`,
        );
    }
    const used = new Set(explicit);
    const result: string[] = [];
    for (const v of inputs) {
      if (v.sku) {
        result.push(v.sku);
        continue;
      }
      const base = autoSku(slug, v.size, v.color) || 'SKU';
      let sku = base;
      for (
        let n = 2;
        used.has(sku) || (await this.variants.exists({ where: { sku } }));
        n++
      ) {
        sku = `${base}-${n}`;
      }
      used.add(sku);
      result.push(sku);
    }
    return result;
  }

  private assertDistinctVariants(
    list: { size?: string | null; color?: string | null }[],
  ) {
    const seen = new Set<string>();
    for (const v of list) {
      const key = variantKey(v.size, v.color);
      if (seen.has(key)) {
        throw new ConflictException(
          `Duplicate variant ${v.size ?? '(no size)'} / ${v.color ?? '(no colour)'}`,
        );
      }
      seen.add(key);
    }
  }

  private assertSalePrice(price: number, salePrice?: number | null) {
    if (salePrice !== null && salePrice !== undefined && salePrice >= price) {
      throw new BadRequestException('salePrice must be lower than price');
    }
  }

  private async assertSlugFree(slug: string) {
    if (await this.products.exists({ where: { slug } })) {
      throw new ConflictException(`Slug "${slug}" is already used`);
    }
    return slug;
  }

  private async mustFindCategory(id: string) {
    const exists = await this.dataSource
      .getRepository(Category)
      .exists({ where: { id } });
    if (!exists) throw new BadRequestException('Category not found');
  }

  private async mustFindProduct(id: string) {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async mustFindImage(productId: string, imageId: string) {
    const image = await this.images.findOne({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Image not found');
    return image;
  }

  /** Whether any order references the product (order_item is created by BE-15). */
  private async wasOrdered(
    productId: string,
    m: EntityManager = this.dataSource.manager,
  ) {
    const [{ present }] = await m.query<{ present: boolean }[]>(
      `SELECT to_regclass('public.order_item') IS NOT NULL AS present`,
    );
    if (!present) return false;
    const rows = await m.query<unknown[]>(
      'SELECT 1 FROM order_item WHERE "productId" = $1 LIMIT 1',
      [productId],
    );
    return rows.length > 0;
  }

  private async deleteImageFile(
    image: Pick<ProductImage, 'imagekitFileId' | 'url'>,
  ) {
    if (!image.imagekitFileId) return;
    try {
      await imagekit.deleteFile(image.imagekitFileId);
    } catch (err) {
      this.logger.warn(
        `Could not delete ImageKit file ${image.imagekitFileId}: ${(err as Error).message}`,
      );
    }
  }

  private log(activity: ActivityType, description: string, actor: AuthUser) {
    return this.activityLogs.createActivityLog({
      activity,
      description,
      user: { id: actor.id } as Users,
    });
  }
}

function extensionOf(mimetype: string) {
  return mimetype === 'image/png'
    ? '.png'
    : mimetype === 'image/webp'
      ? '.webp'
      : '.jpg';
}
