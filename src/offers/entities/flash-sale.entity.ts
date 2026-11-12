import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from 'src/products/entities/product.entity';

/**
 * A time-boxed percentage discount on one product. Sales for the same
 * product never overlap (enforced by the admin service, BE-18), so at most
 * one is live at any moment. PricingService applies it before salePrice.
 */
@Entity('flash_sale')
@Index(['productId', 'startsAt', 'endsAt'])
export class FlashSale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'varchar', length: 120, nullable: true })
  title: string | null;

  /** 1–90 */
  @Column({ type: 'int' })
  discountPercent: number;

  @Column({ type: 'timestamp' })
  startsAt: Date;

  @Column({ type: 'timestamp' })
  endsAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
