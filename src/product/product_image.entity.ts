import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity'; // Assuming the Product entity is in the same directory
import { ProductVariant } from './product_variant.entity'; // Assuming the ProductVariant entity is in the same directory

@Entity()
export class ProductImage {
  @PrimaryGeneratedColumn()
  id: number;

  //   @ManyToOne(() => Product, (product) => product.images)
  //   @JoinColumn({ name: 'product_id' })
  //   product: Product;

  //   @ManyToOne(() => ProductVariant, (variant) => variant.images, {
  //     nullable: true,
  //   })
  //   @JoinColumn({ name: 'variant_id' })
  //   variant: ProductVariant;

  @Column()
  product_id: number;

  @Column()
  variant_id: number;

  @Column('text')
  image_url: string[]; // Image file path or URL

  @Column({ default: false })
  is_main: boolean; // Indicates if it's the main image for the product

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;
}
