import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from 'src/common/decimal.transformer';
import { Product } from './product.entity';

/**
 * A sellable size/colour combination. Stock lives here and is only ever
 * decremented with a guarded UPDATE (`stock >= :q`, BE-15); the CHECK makes
 * negative stock impossible even if a code path forgets the guard.
 */
@Entity('product_variant')
@Check('"stock" >= 0')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (p) => p.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'varchar', length: 40, nullable: true })
  size: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  color: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  sku: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  /** Overrides the product price for this variant when set. */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  price: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
