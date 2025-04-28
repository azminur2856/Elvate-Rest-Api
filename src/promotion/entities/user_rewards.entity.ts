import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('user_rewards')
export class UserRewards {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number; // or UUID

  @Column()
  balance: number;

  @Column()
  points: number; // positive or negative change

  @Column()
  reason: string;

  @Column({ nullable: true })
  order_id: number; // can be null if not linked to an order

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
