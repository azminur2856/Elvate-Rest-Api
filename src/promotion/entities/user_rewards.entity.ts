import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('user_rewards')
export class UserRewards {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  balance: number;

  @Column()
  points: number; // positive or negative change

  @Column()
  reason: string;

  @Column({ nullable: true })
  order_id: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
