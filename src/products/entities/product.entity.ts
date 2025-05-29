import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { OrderItem } from '../../orders/entities/order-item.entity';

export enum ProductCategory {
  ELECTRONICS = 'ELECTRONICS',
  CLOTHING = 'CLOTHING',
  T_SHIRTS = 'T_SHIRTS',
  SHIRTS = 'SHIRTS',
  PANTS = 'PANTS',
  SHOES = 'SHOES',
  ACCESSORIES = 'ACCESSORIES',
  BOOKS = 'BOOKS',
  HOME = 'HOME',
  SPORTS = 'SPORTS',
  BEAUTY = 'BEAUTY',
  FOOD = 'FOOD',
  OTHER = 'OTHER'
}

/**
 * Product entity representing a product in the e-commerce system.
 * @class Product
 * @description This entity stores all product-related information including basic details,
 * pricing, inventory, and categorization.
 */
@Entity('products')
export class Product {
  @ApiProperty({ description: 'The unique identifier of the product' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'The name of the product', maxLength: 100 })
  @Column({ length: 100 })
  name: string;

  @ApiProperty({ description: 'The detailed description of the product' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ description: 'The price of the product', type: 'number', format: 'decimal' })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @ApiProperty({ description: 'The discounted price of the product (if available)', type: 'number', format: 'decimal', nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  discountedPrice: number;

  @ApiProperty({ description: 'The current stock quantity of the product', type: 'integer', default: 0 })
  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @ApiProperty({ description: 'The category of the product', enum: ProductCategory })
  @Column({
    type: 'enum',
    enum: ProductCategory,
    nullable: true
  })
  category: ProductCategory;

  @ApiProperty({ description: 'Available sizes for the product', type: [String], default: [] })
  @Column('varchar', { array: true, default: [] })
  sizes: string[];

  @ApiProperty({ description: 'Available colors for the product', type: [String], default: [] })
  @Column('varchar', { array: true, default: [] })
  colors: string[];

  @ApiProperty({ description: 'Product images URLs', type: [String], default: [] })
  @Column('varchar', { array: true, default: [] })
  images: string[];

  @ApiProperty({ description: 'Whether the product is currently active', type: 'boolean', default: true })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Whether the product is featured', type: 'boolean', default: false })
  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @ApiProperty({ description: 'Number of times the product has been viewed', type: 'integer', default: 0 })
  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @ApiProperty({ description: 'Average product rating', type: 'number', format: 'decimal', default: 0 })
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @ApiProperty({ description: 'Number of product reviews', type: 'integer', default: 0 })
  @Column({ type: 'int', default: 0 })
  reviewCount: number;

  @ApiProperty({ 
    description: 'Product specifications in JSON format', 
    type: 'object',
    additionalProperties: true,
    nullable: true 
  })
  @Column({ type: 'jsonb', nullable: true })
  specifications: Record<string, any>;

  @ApiProperty({ description: 'Product brand name', maxLength: 255, nullable: true })
  @Column({ length: 255, nullable: true })
  brand: string;

  @ApiProperty({ description: 'Product material', maxLength: 255, nullable: true })
  @Column({ length: 255, nullable: true })
  material: string;

  @ApiProperty({ description: 'Product care instructions', maxLength: 255, nullable: true })
  @Column({ length: 255, nullable: true })
  careInstructions: string;

  @ApiProperty({ description: 'Whether the product is a new arrival', type: 'boolean', default: false })
  @Column({ type: 'boolean', default: false })
  isNewArrival: boolean;

  @ApiProperty({ description: 'Whether the product is a best seller', type: 'boolean', default: false })
  @Column({ type: 'boolean', default: false })
  isBestSeller: boolean;

  @ApiProperty({ description: 'Whether the product is on sale', type: 'boolean', default: false })
  @Column({ type: 'boolean', default: false })
  isOnSale: boolean;

  @ApiProperty({ description: 'The date when the product was created' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'The date when the product was last updated' })
  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => OrderItem, orderItem => orderItem.product)
  orderItems: OrderItem[];
} 