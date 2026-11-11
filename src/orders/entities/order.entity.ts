import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Users } from 'src/users/entities/users.entity';
import { Coupon } from 'src/offers/entities/coupon.entity';
import { decimalTransformer } from 'src/common/decimal.transformer';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../order.enums';
import { OrderItem } from './order-item.entity';
import { OrderStatusHistory } from './order-status-history.entity';
import type { AddressSnapshot } from 'src/addresses/addresses.service';

const money = {
  type: 'decimal' as const,
  precision: 12,
  scale: 2,
  transformer: decimalTransformer,
};

/** Table `orders` ("order" is an SQL keyword). */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ELV-YYMMDD-XXXX */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  orderNumber: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: Users | null;

  @Index()
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
  paymentStatus: PaymentStatus;

  @Column(money)
  subtotal: number;

  @Column({ ...money, default: 0 })
  discount: number;

  @Column({ ...money, default: 0 })
  shippingFee: number;

  @Column(money)
  total: number;

  @Column({ type: 'uuid', nullable: true })
  couponId: string | null;

  @ManyToOne(() => Coupon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  couponCode: string | null;

  /** Copy of the address at checkout (editing the address later changes nothing). */
  @Column({ type: 'jsonb' })
  shippingAddress: AddressSnapshot;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  deliveryManId: string | null;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deliveryManId' })
  deliveryMan: Users | null;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeSessionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripePaymentIntentId: string | null;

  @Column({ type: 'timestamp' })
  placedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => OrderStatusHistory, (h) => h.order, { cascade: true })
  history: OrderStatusHistory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
