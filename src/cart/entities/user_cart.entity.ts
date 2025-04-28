import { ProductVariant } from 'src/product/entities/product_variant.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CustomDateTransformer } from '../dto/date_customized.dto';

@Entity()
export class UserCart {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  variant_id: number;

  @Column()
  quantity: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  // Use @UpdateDateColumn() for auto-updating the timestamp when the entity is updated
  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  // @Column({
  //   type: 'timestamp',
  //   default: () => 'CURRENT_TIMESTAMP',
  //   transformer: new CustomDateTransformer(),
  //   update: false, // Prevent updates
  // })
  // created_at: string;

  // @Column({
  //   type: 'timestamp',
  //   default: () => 'CURRENT_TIMESTAMP',
  //   onUpdate: 'CURRENT_TIMESTAMP',
  //   transformer: new CustomDateTransformer(),
  // })
  // updated_at: string;

  //   // Set up FK relationship with User
  //   @ManyToOne(() => User)
  //   @JoinColumn({ name: 'user_id' })
  //   user: User;

  // Set up FK relationship with ProductVariant
  @ManyToOne(() => ProductVariant)
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;
}
