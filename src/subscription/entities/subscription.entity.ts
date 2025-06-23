import { Users } from 'src/users/entities/users.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';

@Entity()
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  stripeSubscriptionId: string;

  @Column()
  plan: '1m' | '6m' | '12m';

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @ManyToOne(() => Users, (user) => user.subscriptions)
  user: Users;
}
