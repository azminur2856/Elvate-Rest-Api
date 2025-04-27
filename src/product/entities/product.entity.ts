import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { ProductVariant } from './product_variant.entity';
import { ProductImage } from './product_image.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column('decimal')
  base_price: number;

  @Column()
  brand_id: number;

  @Column()
  category_id: number;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string;

  // @OneToMany(() => ProductVariant, (variant) => variant.product)
  // variants: ProductVariant[];

  // @OneToMany(() => ProductImage, (image) => image.product)
  // images: ProductImage[];
}
