import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Users } from 'src/users/entities/users.entity';
import { Product } from 'src/products/entities/product.entity';
import { ReviewStatus } from '../enums/review-status.enum';

/**
 * Product review (BE-19). `id` stays an integer serial (changing a primary
 * key type is not additive); the API sends it as a string.
 * One review per user per product (partial unique index); rows from before
 * the product link have productId NULL and are ignored by the shop.
 */
@Entity()
@Index('UQ_review_user_product', ['user', 'productId'], {
  unique: true,
  where: '"productId" IS NOT NULL',
})
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'smallint' }) // 1–5
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING })
  reviewStatus: ReviewStatus;

  ////////// RELATIONSHIPS //////////
  @ManyToOne(() => Users, (user) => user.reviews, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  user: Users | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product | null;
}
