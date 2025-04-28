import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';

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
  image_url: string[];

  @Column({ default: false })
  is_main: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  // Use @UpdateDateColumn() for auto-updating the timestamp when the entity is updated
  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  // // product_image.entity.ts
  // @ManyToOne(() => Product, (product) => product.images)
  // product: Product;
}
