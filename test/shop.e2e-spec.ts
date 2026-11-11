import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Users } from '../src/users/entities/users.entity';
import { Role } from '../src/users/enums/role.enum';
import { Category } from '../src/categories/entities/category.entity';
import { Product } from '../src/products/entities/product.entity';
import { Order } from '../src/orders/entities/order.entity';

jest.setTimeout(180_000);

/**
 * The whole shop in one go (BE-23):
 * cart → quote → COD order → staff confirm → assign → ship → rider delivers → review → approve.
 * Creates its own users + product and removes them afterwards.
 */
describe('Shop flow (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const run = Date.now().toString(36);
  const password = 'E2e@12345';
  const emails = {
    buyer: `e2e-${run}-buyer@elvate.test`,
    staff: `e2e-${run}-staff@elvate.test`,
    rider: `e2e-${run}-rider@elvate.test`,
  };
  const agents: Record<
    keyof typeof emails,
    ReturnType<typeof request.agent>
  > = {} as never;
  let productId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    ds = app.get(DataSource);

    const roles = {
      buyer: Role.BUYER,
      staff: Role.STAFF,
      rider: Role.DELIVERY_MAN,
    };
    for (const [key, email] of Object.entries(emails) as [
      keyof typeof emails,
      string,
    ][]) {
      const repo = ds.getRepository(Users);
      await repo.save(
        repo.create({
          firstName: `E2E ${key}`,
          email,
          password,
          role: roles[key],
          isActive: true,
          isEmailVerified: true,
        }),
      );
      agents[key] = request
        .agent(app.getHttpServer())
        .set('x-forwarded-for', `198.18.0.${Object.keys(agents).length + 10}`);
      await agents[key]
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
    }
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      const users = await ds
        .getRepository(Users)
        .find({ where: { email: In(Object.values(emails)) } });
      const ids = users.map((u) => u.id);
      if (ids.length) await ds.getRepository(Order).delete({ userId: In(ids) });
      if (productId) await ds.getRepository(Product).delete(productId);
      if (ids.length) await ds.getRepository(Users).delete(ids);
    }
    await app?.close();
  });

  it('sells, delivers and reviews a product', async () => {
    const men = await ds
      .getRepository(Category)
      .findOneByOrFail({ slug: 'men' });

    // staff creates a product
    const created = await agents.staff
      .post('/admin/products')
      .send({
        name: `E2E Tee ${run}`,
        description: 'e2e test product',
        categoryId: men.id,
        price: 500,
        variants: [{ size: 'M', color: 'Black', stock: 5 }],
      })
      .expect(201);
    productId = created.body.id;
    const variantId: string = created.body.variants[0].id;

    // buyer: address, cart, quote, COD order
    const address = await agents.buyer
      .post('/addresses')
      .send({
        fullName: 'E2E Buyer',
        phone: '01712345678',
        addressLine: 'Road 1',
        city: 'Dhaka',
      })
      .expect(201);
    await agents.buyer
      .post('/cart/items')
      .send({ variantId, quantity: 2 })
      .expect(201);

    const quote = await agents.buyer.post('/orders/quote').send({}).expect(200);
    expect(quote.body).toMatchObject({
      subtotal: 1000,
      discount: 0,
      shippingFee: 60,
      total: 1060,
    });

    const placed = await agents.buyer
      .post('/orders')
      .send({ addressId: address.body.id, paymentMethod: 'COD' })
      .expect(201);
    const orderId: string = placed.body.order.id;
    expect(placed.body).toMatchObject({
      checkoutUrl: null,
      order: { status: 'PENDING', paymentStatus: 'UNPAID', total: 1060 },
    });
    expect((await agents.buyer.get('/cart').expect(200)).body.itemCount).toBe(
      0,
    );
    expect(
      (await agents.staff.get(`/admin/products/${productId}`).expect(200)).body
        .variants[0].stock,
    ).toBe(3);

    // staff moves it along and assigns the rider
    const rider = await ds
      .getRepository(Users)
      .findOneByOrFail({ email: emails.rider });
    for (const status of ['CONFIRMED', 'PROCESSING']) {
      await agents.staff
        .patch(`/admin/orders/${orderId}/status`)
        .send({ status })
        .expect(200);
    }
    await agents.staff
      .patch(`/admin/orders/${orderId}/assign`)
      .send({ deliveryManId: rider.id })
      .expect(200);
    await agents.staff
      .patch(`/admin/orders/${orderId}/status`)
      .send({ status: 'SHIPPED' })
      .expect(200);

    // rider delivers; COD becomes PAID
    await agents.rider
      .patch(`/delivery/orders/${orderId}/status`)
      .send({ status: 'OUT_FOR_DELIVERY' })
      .expect(200);
    const delivered = await agents.rider
      .patch(`/delivery/orders/${orderId}/status`)
      .send({ status: 'DELIVERED' })
      .expect(200);
    expect(delivered.body).toMatchObject({
      status: 'DELIVERED',
      paymentStatus: 'PAID',
    });

    // buyer reviews; staff approves; the rating updates
    const detail = await agents.buyer.get(`/orders/${orderId}`).expect(200);
    expect(detail.body.items[0].canReview).toBe(true);
    const slug: string = created.body.slug;
    expect(
      (
        await agents.buyer
          .get(`/products/${slug}/reviews/eligibility`)
          .expect(200)
      ).body.canReview,
    ).toBe(true);
    const review = await agents.buyer
      .post(`/products/${productId}/reviews`)
      .send({ rating: 4, comment: 'Fits well' })
      .expect(201);
    expect(review.body.status).toBe('PENDING');
    await agents.staff
      .patch(`/admin/reviews/${review.body.id}/status`)
      .send({ status: 'APPROVED' })
      .expect(200);

    const page = await request(app.getHttpServer())
      .get(`/products/${slug}/reviews`)
      .expect(200);
    expect(page.body).toMatchObject({ count: 1, average: 4 });
    const card = await request(app.getHttpServer())
      .get(`/products/${slug}`)
      .expect(200);
    expect(card.body).toMatchObject({ rating: 4, reviewCount: 1 });
  });
});
