import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Users } from 'src/users/entities/users.entity';
import { OrderStatus } from '../order.enums';

/** One row per status change; `changedBy` null = system (Stripe webhook, expiry). */
@Entity('order_status_history')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (o) => o.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'enum', enum: OrderStatus })
  status: OrderStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** BE-29: an admin correction of a stuck delivery (not a normal step). */
  @Column({ type: 'boolean', default: false })
  correction: boolean;

  @Column({ type: 'uuid', nullable: true })
  changedById: string | null;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changedById' })
  changedBy: Users | null;

  @CreateDateColumn()
  createdAt: Date;
}
