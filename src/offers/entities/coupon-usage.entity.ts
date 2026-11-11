import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Coupon } from './coupon.entity';
import { Users } from 'src/users/entities/users.entity';
import { Order } from 'src/orders/entities/order.entity';

/** One row per order that used a coupon; removed again when the order is cancelled/returned. */
@Entity('coupon_usage')
@Index(['couponId', 'userId'])
export class CouponUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  couponId: string;

  @ManyToOne(() => Coupon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: Users | null;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @CreateDateColumn()
  createdAt: Date;
}
