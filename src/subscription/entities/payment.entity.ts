import { Users } from 'src/users/entities/users.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
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
}
