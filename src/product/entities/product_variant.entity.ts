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

@Entity()
export class ProductVariant {
  @PrimaryGeneratedColumn()
  id: number;

  //   @ManyToOne(() => Product, (product) => product.variants)
  //   @JoinColumn({ name: 'product_id' })
  //   product: Product;
  @Column()
  product_id: number;

  @Column()
  variant_name: string;

  @Column('decimal')
  price: number;

  @Column('int')
  stock: number;

  @Column()
  sku: string;

  //   @ManyToOne(() => Product, (product) => product.variants)
  //   product: Product;
}
