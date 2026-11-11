import { Users } from 'src/users/entities/users.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Subscription } from './subscription.entity';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique: Stripe retries webhooks, so the same invoice must never be recorded twice. */
  @Column({ unique: true })
  stripeInvoiceId: string;

  @Column('decimal')
  amount: number;

  @Column()
  currency: string;

  @Column()
  invoiceUrl: string;

  @CreateDateColumn()
  paidAt: Date;

  @ManyToOne(() => Users, (user) => user.payments)
  user: Users;

  /**
   * The subscription period this payment paid for. Nullable: rows created
   * before this column existed have no link.
   */
  @ManyToOne(() => Subscription, (subscription) => subscription.payments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  subscription: Subscription | null;
}
