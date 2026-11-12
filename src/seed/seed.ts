/**
 * Demo data (BE-22). Idempotent: re-running only adds what is missing.
 *
 *   npm run seed -- --yes              # categories, products + images, coupons, flash sale, demo users
 *   npm run seed -- --yes --no-images  # skip the ImageKit uploads
 *
 * Writes to the database in DATABASE_URL. It never changes the schema
 * (synchronize is off), so run it only against a database whose schema is
 * already up to date, i.e. on production only after the backend is deployed.
 */
import '../set-timezone';
import 'dotenv/config';
import * as path from 'path';
import { DataSource, EntityManager } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { ProductImage } from '../products/entities/product-image.entity';
import { Coupon, CouponType } from '../offers/entities/coupon.entity';
import { FlashSale } from '../offers/entities/flash-sale.entity';
import { Users } from '../users/entities/users.entity';
import { Role } from '../users/enums/role.enum';
import { ROOT_CATEGORIES } from '../categories/categories.service';
import { CATEGORIES, PRODUCTS, SeedProduct } from './catalog-data';
import { productArt } from './product-art';
import { slugify } from '../common/slug';
import { imagekit } from '../auth/utility/imagekit';
import { AppSetting } from '../settings/app-setting.entity';
import { SETTINGS } from '../settings/settings.registry';
import { demoPasswordProblem } from './demo-password';

const args = new Set(process.argv.slice(2));
const DAY = 24 * 3600 * 1000;
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? '';
const DEMO_USERS = [
  {
    firstName: 'Demo',
    lastName: 'Rider',
    email: 'rider.demo@example.com',
    phone: '01800000001',
    role: Role.DELIVERY_MAN,
  },
  {
    firstName: 'Demo',
    lastName: 'Staff',
    email: 'staff.demo@example.com',
    phone: '01800000002',
    role: Role.STAFF,
  },
];

const sku = (...parts: string[]) =>
  parts
    .map((p) =>
      p
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean)
    .join('-')
    .slice(0, 80);

/** Deterministic pseudo-random stock (0–18) so re-runs and tests look the same. */
const stockFor = (key: string) => {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 9 === 0 ? 0 : (h % 18) + 1;
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const host = new URL(process.env.DATABASE_URL).host;
  console.log(`Seeding database at ${host}`);
  if (!args.has('--yes')) {
    console.log(
      'Nothing written. Re-run with --yes to confirm this is the right database.',
    );
    return;
  }
  const problem = demoPasswordProblem(process.env.SEED_DEMO_PASSWORD);
  if (problem) {
    console.error(`Nothing written: ${problem}.`);
    process.exitCode = 1;
    return;
  }

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [path.resolve(__dirname, '..') + '/**/*.entity{.ts,.js}'],
    synchronize: false,
  });
  await ds.initialize();
  try {
    const categories = await seedCategories(ds.manager);
    const products = await seedProducts(ds.manager, categories);
    if (!args.has('--no-images')) await seedImages(ds.manager, products);
    await seedCoupons(ds.manager);
    await seedFlashSale(ds.manager, products);
    await seedUsers(ds.manager);
    await seedSettings(ds.manager);
    console.log('Done.');
  } finally {
    await ds.destroy();
  }
}

async function seedCategories(m: EntityManager) {
  const repo = m.getRepository(Category);
  await repo
    .createQueryBuilder()
    .insert()
    .values(ROOT_CATEGORIES.map((r) => ({ ...r, parentId: null })))
    .orIgnore()
    .execute();
  const roots = new Map(
    (
      await repo.find({ where: ROOT_CATEGORIES.map((r) => ({ slug: r.slug })) })
    ).map((r) => [r.slug, r]),
  );

  const bySlug = new Map<string, Category>();
  let created = 0;
  for (const c of CATEGORIES) {
    let row = await repo.findOne({ where: { slug: c.key } });
    if (!row) {
      row = await repo.save(
        repo.create({
          name: c.name,
          slug: c.key,
          parentId: roots.get(c.parent)!.id,
          sortOrder: c.sortOrder,
        }),
      );
      created++;
    }
    bySlug.set(c.key, row);
  }
  console.log(
    `Categories: ${created} created, ${CATEGORIES.length - created} already there`,
  );
  return bySlug;
}

async function seedProducts(
  m: EntityManager,
  categories: Map<string, Category>,
) {
  const repo = m.getRepository(Product);
  const result: { product: Product; seed: SeedProduct }[] = [];
  let created = 0;
  for (const p of PRODUCTS) {
    const slug = slugify(p.name);
    let product = await repo.findOne({ where: { slug } });
    if (!product) {
      product = await m.transaction(async (t) => {
        const saved = await t.save(
          t.create(Product, {
            name: p.name,
            slug,
            description: p.description,
            brand: p.brand,
            categoryId: categories.get(p.category)!.id,
            price: p.price,
            salePrice: p.salePrice ?? null,
            material: p.material,
            careInstructions: p.care,
            specifications: p.specs,
            isFeatured: p.featured ?? false,
            isNewArrival: p.newArrival ?? false,
            isActive: true,
          }),
        );
        await t.insert(
          ProductVariant,
          p.colors.flatMap((color) =>
            p.sizes.map((size) => ({
              productId: saved.id,
              size,
              color: color.name,
              sku: sku(slug, size, color.name),
              stock: stockFor(`${slug}|${size}|${color.name}`),
            })),
          ),
        );
        return saved;
      });
      created++;
    }
    result.push({ product, seed: p });
  }
  console.log(
    `Products: ${created} created, ${PRODUCTS.length - created} already there`,
  );
  return result;
}

/** One illustration per colour, uploaded to ImageKit products/<id>/; skipped when the product already has images. */
async function seedImages(
  m: EntityManager,
  products: { product: Product; seed: SeedProduct }[],
) {
  const repo = m.getRepository(ProductImage);
  let uploaded = 0;
  for (const { product, seed } of products) {
    if (await repo.exists({ where: { productId: product.id } })) continue;
    for (const [i, color] of seed.colors.entries()) {
      const png = await productArt(
        seed.garment,
        color.hex,
        `${seed.name} · ${color.name}`,
      );
      const res = await imagekit.upload({
        file: png,
        fileName: `${product.slug}-${slugify(color.name)}.png`,
        folder: `/products/${product.id}`,
        useUniqueFileName: true,
      });
      await repo.insert({
        productId: product.id,
        url: res.url,
        imagekitFileId: res.fileId,
        isMain: i === 0,
        sortOrder: i,
      });
      uploaded++;
    }
  }
  console.log(`Images: ${uploaded} uploaded to ImageKit`);
}

async function seedCoupons(m: EntityManager) {
  const repo = m.getRepository(Coupon);
  const now = Date.now();
  const coupons = [
    {
      code: 'WELCOME10',
      description: '10% off your first order (up to ৳300)',
      type: CouponType.PERCENT,
      value: 10,
      minOrderAmount: 1000,
      maxDiscount: 300,
      usageLimit: null,
      perUserLimit: 1,
    },
    {
      code: 'FLAT200',
      description: '৳200 off orders of ৳2,000 or more',
      type: CouponType.FIXED,
      value: 200,
      minOrderAmount: 2000,
      maxDiscount: null,
      usageLimit: 500,
      perUserLimit: 2,
    },
  ];
  let created = 0;
  for (const c of coupons) {
    if (await repo.exists({ where: { code: c.code } })) continue;
    await repo.insert({
      ...c,
      startsAt: new Date(now - DAY),
      expiresAt: new Date(now + 365 * DAY),
      isPublic: true,
      isActive: true,
    });
    created++;
  }
  console.log(`Coupons: ${created} created`);
}

/** A 7-day 25% flash sale on the first featured product without a sale price. */
async function seedFlashSale(
  m: EntityManager,
  products: { product: Product; seed: SeedProduct }[],
) {
  const target = products.find(
    (p) => p.seed.featured && !p.seed.salePrice,
  )?.product;
  if (!target) return;
  const now = new Date();
  const repo = m.getRepository(FlashSale);
  const live = await repo
    .createQueryBuilder('fs')
    .where('fs.productId = :id AND fs.isActive = true AND fs.endsAt > :now', {
      id: target.id,
      now,
    })
    .getExists();
  if (live) return console.log('Flash sale: already running');
  await repo.insert({
    productId: target.id,
    title: 'Weekend flash sale',
    discountPercent: 25,
    startsAt: now,
    endsAt: new Date(now.getTime() + 7 * DAY),
    isActive: true,
  });
  console.log(`Flash sale: 25% on "${target.name}" for 7 days`);
}

async function seedUsers(m: EntityManager) {
  const repo = m.getRepository(Users);
  for (const u of DEMO_USERS) {
    if (await repo.exists({ where: { email: u.email } })) continue;
    // save() runs the entity's bcrypt hook
    await repo.save(
      repo.create({
        ...u,
        password: DEMO_PASSWORD,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
      }),
    );
    console.log(
      `User: ${u.email} (${u.role}), password from SEED_DEMO_PASSWORD`,
    );
  }
}

/** BE-25: create missing switches with their default (SMS stays OFF). */
async function seedSettings(m: EntityManager) {
  const result = await m
    .createQueryBuilder()
    .insert()
    .into(AppSetting)
    .values(SETTINGS.map((s) => ({ key: s.key, enabled: s.defaultEnabled })))
    .orIgnore()
    .execute();
  const created = (result.raw as unknown[] | undefined)?.length ?? 0;
  console.log(
    `Settings: ${created} created (existing switches are left as they are)`,
  );
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
