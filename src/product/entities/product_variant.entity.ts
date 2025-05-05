import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { ProductImage } from './product_image.entity';
import { Expose } from 'class-transformer';

@Entity()
export class ProductVariant {
  @Expose()
  @PrimaryGeneratedColumn()
  id: number;

  @Expose()
  @Column()
  product_id: number;

  @Expose()
  @ManyToOne(() => Product, (product) => product.variants)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Expose()
  @Column()
  variant_name: string;

  @Expose()
  @Column('decimal')
  price: number;

  @Expose()
  @Column('int')
  stock: number;

  @Expose()
  @Column()
  sku: string;

  @OneToMany(() => ProductImage, (image) => image.variant)
  images: ProductImage[];
}
