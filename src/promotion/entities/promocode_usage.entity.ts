import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Coupon } from './coupon.entity';

@Entity('promo_code_usages')
export class PromoCodeUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  coupon_id: number;

  @ManyToOne(() => Coupon, (coupon) => coupon.usages)
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon;

  @Column({ type: 'timestamp' })
  used_at: Date;
}
