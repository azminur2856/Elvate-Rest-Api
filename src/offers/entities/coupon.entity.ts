import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from 'src/common/decimal.transformer';

export enum CouponType {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

const money = {
  type: 'decimal' as const,
  precision: 12,
  scale: 2,
  transformer: decimalTransformer,
};

@Entity('coupon')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stored uppercase. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: CouponType })
  type: CouponType;

  /** Percent (1–100) for PERCENT, taka for FIXED. */
  @Column(money)
  value: number;

  @Column({ ...money, nullable: true })
  minOrderAmount: number | null;

  /** Cap for PERCENT coupons. */
  @Column({ ...money, nullable: true })
  maxDiscount: number | null;

  @Column({ type: 'timestamp' })
  startsAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'int', nullable: true })
  usageLimit: number | null;

  @Column({ type: 'int', nullable: true })
  perUserLimit: number | null;

  @Column({ type: 'int', default: 0 })
  usedCount: number;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
