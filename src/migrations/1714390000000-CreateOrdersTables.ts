import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdersTables1714390000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create orders table
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "userId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "totalAmount" decimal(10,2) NOT NULL DEFAULT 0,
        "refundAmount" decimal(10,2),
        "notes" text,
        "adminNotes" text,
        "paymentDetails" jsonb,
        "history" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_orders_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create order_items table
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "orderId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "price" decimal(10,2) NOT NULL,
        "total" decimal(10,2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_order_items_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_order_items_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "idx_orders_user" ON "orders"("userId");
      CREATE INDEX "idx_orders_status" ON "orders"("status");
      CREATE INDEX "idx_orders_created" ON "orders"("createdAt");
      CREATE INDEX "idx_order_items_order" ON "order_items"("orderId");
      CREATE INDEX "idx_order_items_product" ON "order_items"("productId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders" CASCADE`);
  }
} 