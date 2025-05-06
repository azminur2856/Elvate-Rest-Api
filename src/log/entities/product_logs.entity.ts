import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class ProductLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  product_id: number;

  @Column()
  action: 'create' | 'update' | 'delete';

  @Column({ type: 'jsonb', nullable: true })
  previous_state: any;

  @Column({ type: 'jsonb', nullable: true })
  new_state: any;

  @Column()
  performed_by: number;

  @Column()
  performed_by_role: string;

  @CreateDateColumn()
  timestamp: Date;
}
