import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Users } from '../../users/entities/users.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatus } from '../enums/order-status.enum';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => Users, user => user.orders)
  @JoinColumn({ name: 'userId' })
  user: Users;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  refundAmount: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  @Column({ type: 'jsonb', nullable: true })
  paymentDetails: {
    method: string;
    transactionId: string;
    status: string;
    amount: number;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  history: Array<{
    status: OrderStatus;
    timestamp: Date;
    changedBy: string;
    notes?: string;
  }> | null;

  @OneToMany(() => OrderItem, orderItem => orderItem.order, {
    cascade: true,
  })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 