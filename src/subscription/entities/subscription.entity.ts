import { Users } from 'src/users/entities/users.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Payment } from './payment.entity';

/**
 * One row per paid period. A renewal (Stripe `invoice.paid` with
 * billing_reason `subscription_cycle`) adds a new row with the same
 * `stripeSubscriptionId`.
 */
@Entity()
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  stripeSubscriptionId: string;

  @Column({ default: false })
  isCancelled: boolean;

  @Column()
  plan: '1m' | '6m' | '12m';

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @ManyToOne(() => Users, (user) => user.subscriptions)
  user: Users;

  @OneToMany(() => Payment, (payment) => payment.subscription)
  payments: Payment[];
}
