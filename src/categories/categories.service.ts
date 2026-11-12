import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from 'src/products/entities/product.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { slugify, uniqueSlug } from 'src/common/slug';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { actorLabel, AuthUser } from 'src/common/auth-user';
import { Users } from 'src/users/entities/users.entity';
import { fromImgPath, toImgPath } from 'src/common/media';

/** Contract `Category`. `children` is present in tree responses. */
export type CategoryView = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  /** Products in this category and all of its descendants. */
  productCount: number;
  children?: CategoryView[];
};

export type Crumb = { name: string; slug: string };

/** Required top-level categories: always present, never deletable. */
export const ROOT_CATEGORIES = [
  { name: 'Men', slug: 'men', sortOrder: 1 },
  { name: 'Women', slug: 'women', sortOrder: 2 },
  { name: 'Children', slug: 'children', sortOrder: 3 },
] as const;
const ROOT_SLUGS: ReadonlySet<string> = new Set(
  ROOT_CATEGORIES.map((r) => r.slug),
);

type Node = Omit<CategoryView, 'children'> & { children: Node[] };

@Injectable()
export class CategoriesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  /** Idempotent (ON CONFLICT DO NOTHING), so it is safe on every boot and on any instance. */
  async onApplicationBootstrap() {
    try {
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(Category)
        .values(ROOT_CATEGORIES.map((r) => ({ ...r, parentId: null })))
        .orIgnore()
        .execute();
    } catch (err) {
      this.logger.error('Could not ensure root categories', err as Error);
    }
  }

  // ---------- reads ----------

  /** Whole tree (roots first, then by sortOrder, name). Counts active products only. */
  async tree(): Promise<CategoryView[]> {
    const { roots } = await this.buildTree(true);
    return roots;
  }

  async findBySlug(
    slug: string,
  ): Promise<CategoryView & { breadcrumb: Crumb[] }> {
    const { byId } = await this.buildTree(true);
    const node = [...byId.values()].find((n) => n.slug === slug);
    if (!node) throw new NotFoundException('Category not found');
    return { ...node, breadcrumb: this.breadcrumbOf(node.id, byId) };
  }

  /**
   * Ids of the category with this slug and of all its descendants (for
   * "category includes sub-categories" filters). Null when the slug is unknown.
   */
  async scopeIds(slug: string): Promise<string[] | null> {
    const { byId } = await this.buildTree(false);
    const node = [...byId.values()].find((n) => n.slug === slug);
    if (!node) return null;
    const ids: string[] = [];
    const walk = (n: Node) => {
      ids.push(n.id);
      n.children.forEach(walk);
    };
    walk(node);
    return ids;
  }

  /** Root → leaf breadcrumb for a category id (used by ProductDetail). */
  async breadcrumb(categoryId: string): Promise<Crumb[]> {
    const rows = await this.repo.find();
    const byId = new Map(rows.map((r) => [r.id, r]));
    const crumbs: Crumb[] = [];
    for (
      let c = byId.get(categoryId);
      c && crumbs.length < 20;
      c = c.parentId ? byId.get(c.parentId) : undefined
    ) {
      crumbs.unshift({ name: c.name, slug: c.slug });
    }
    return crumbs;
  }

  /** The root category id of a category (for "related products in the same root"). */
  async rootIdOf(categoryId: string): Promise<string | null> {
    const rows = await this.repo.find({ select: ['id', 'parentId'] });
    const byId = new Map(rows.map((r) => [r.id, r]));
    let c = byId.get(categoryId);
    for (let i = 0; c?.parentId && i < 20; i++) c = byId.get(c.parentId);
    return c?.id ?? null;
  }

  // ---------- admin writes (ADMIN / STAFF) ----------

  async create(dto: CreateCategoryDto, actor: AuthUser): Promise<CategoryView> {
    const parent = dto.parentId
      ? await this.mustFind(dto.parentId, 'Parent category')
      : null;

    const slug = dto.slug
      ? await this.assertSlugFree(dto.slug)
      : await uniqueSlug(
          slugify(parent ? `${parent.slug} ${dto.name}` : dto.name),
          (s) => this.repo.exists({ where: { slug: s } }),
        );

    const saved = await this.repo.save(
      this.repo.create({
        name: dto.name.trim(),
        slug,
        parentId: parent?.id ?? null,
        imageUrl: fromImgPath(dto.imageUrl) ?? null,
        sortOrder: dto.sortOrder ?? 0,
      }),
    );

    await this.log(
      ActivityType.ADMIN_ADD_CATEGORY,
      `${actorLabel(actor)} created category "${saved.name}" (${saved.slug}, ${saved.id})`,
      actor,
    );
    return this.view(saved.id);
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    actor: AuthUser,
  ): Promise<CategoryView> {
    const category = await this.mustFind(id, 'Category');
    const isRoot = this.isRoot(category);

    if (dto.slug !== undefined && dto.slug !== category.slug) {
      if (isRoot)
        throw new BadRequestException(
          'The slug of a root category cannot change',
        );
      category.slug = await this.assertSlugFree(dto.slug);
    }

    if (dto.parentId !== undefined && dto.parentId !== category.parentId) {
      if (isRoot)
        throw new BadRequestException('A root category cannot be moved');
      if (dto.parentId !== null) {
        await this.mustFind(dto.parentId, 'Parent category');
        await this.assertNotInSubtree(id, dto.parentId);
      }
      category.parentId = dto.parentId;
    }

    if (dto.name !== undefined) category.name = dto.name.trim();
    if (dto.imageUrl !== undefined)
      category.imageUrl = fromImgPath(dto.imageUrl);
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;

    // `parent` is not loaded, so save() uses the parentId column.
    await this.repo.save(category);
    await this.log(
      ActivityType.ADMIN_UPDATE_CATEGORY,
      `${actorLabel(actor)} updated category "${category.name}" (${category.slug}, ${id})`,
      actor,
    );
    return this.view(id);
  }

  async remove(id: string, actor: AuthUser): Promise<{ success: true }> {
    const category = await this.mustFind(id, 'Category');
    if (this.isRoot(category)) {
      throw new ConflictException(
        'Root categories (men, women, children) cannot be deleted',
      );
    }
    const children = await this.repo.count({ where: { parentId: id } });
    if (children > 0) {
      throw new ConflictException(
        `Category has ${children} sub-categor${children === 1 ? 'y' : 'ies'}; move or delete them first`,
      );
    }
    const products = await this.productRepo.count({
      where: { categoryId: id },
    });
    if (products > 0) {
      throw new ConflictException(
        `Category has ${products} product${products === 1 ? '' : 's'}; move them to another category first`,
      );
    }

    await this.repo.delete(id);
    await this.log(
      ActivityType.ADMIN_DELETE_CATEGORY,
      `${actorLabel(actor)} deleted category "${category.name}" (${category.slug}, ${id})`,
      actor,
    );
    return { success: true };
  }

  // ---------- helpers ----------

  private isRoot(c: Category) {
    return c.parentId === null && ROOT_SLUGS.has(c.slug);
  }

  private async mustFind(id: string, what: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`${what} not found`);
    return c;
  }

  private async assertSlugFree(slug: string) {
    if (await this.repo.exists({ where: { slug } })) {
      throw new ConflictException(`Slug "${slug}" is already used`);
    }
    return slug;
  }

  /** A category cannot become a child of itself or of one of its descendants. */
  private async assertNotInSubtree(id: string, newParentId: string) {
    const rows = await this.repo.find({ select: ['id', 'parentId'] });
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (let c = byId.get(newParentId), i = 0; c && i < 50; i++) {
      if (c.id === id) {
        throw new BadRequestException(
          'A category cannot be moved under itself or its own sub-category',
        );
      }
      c = c.parentId ? byId.get(c.parentId) : undefined;
    }
  }

  private async view(id: string): Promise<CategoryView> {
    const { byId } = await this.buildTree(true);
    const node = byId.get(id);
    if (!node) throw new NotFoundException('Category not found');
    return node;
  }

  private breadcrumbOf(id: string, byId: Map<string, Node>): Crumb[] {
    const crumbs: Crumb[] = [];
    for (
      let n = byId.get(id);
      n && crumbs.length < 20;
      n = n.parentId ? byId.get(n.parentId) : undefined
    ) {
      crumbs.unshift({ name: n.name, slug: n.slug });
    }
    return crumbs;
  }

  /** Loads every category once and nests them; productCount = own + all descendants. */
  private async buildTree(activeProductsOnly: boolean) {
    const [rows, counts] = await Promise.all([
      this.repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.productCounts(activeProductsOnly),
    ]);

    const byId = new Map<string, Node>();
    for (const r of rows) {
      byId.set(r.id, {
        id: r.id,
        name: r.name,
        slug: r.slug,
        imageUrl: toImgPath(r.imageUrl), // BE-28: never the ImageKit host
        parentId: r.parentId,
        sortOrder: r.sortOrder,
        productCount: counts.get(r.id) ?? 0,
        children: [],
      });
    }

    const roots: Node[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    const total = (n: Node, depth = 0): number => {
      if (depth > 50) return n.productCount; // corrupt cycle guard
      n.productCount += n.children.reduce((s, c) => s + total(c, depth + 1), 0);
      return n.productCount;
    };
    roots.forEach((r) => total(r));

    return { roots, byId };
  }

  private async productCounts(activeOnly: boolean) {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .select('p.categoryId', 'categoryId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.categoryId');
    if (activeOnly) qb.where('p.isActive = true');
    const rows = await qb.getRawMany<{ categoryId: string; count: string }>();
    return new Map(rows.map((r) => [r.categoryId, Number(r.count)]));
  }

  private log(activity: ActivityType, description: string, actor: AuthUser) {
    return this.activityLogs.createActivityLog({
      activity,
      description,
      user: { id: actor.id } as Users,
    });
  }
}
