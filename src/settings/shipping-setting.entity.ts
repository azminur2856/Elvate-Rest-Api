import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Users } from 'src/users/entities/users.entity';

/** The only row of `shipping_settings`. */
export const SHIPPING_ROW_ID = 1;

/**
 * BE-30: the delivery fees an ADMIN changes in Settings (one row, whole BDT).
 * Created on first start from the `SHIPPING_*` env vars; never overwritten.
 */
@Entity('shipping_settings')
export class ShippingSetting {
  @PrimaryColumn({ type: 'smallint' })
  id: number;

  @Column({ type: 'int' })
  insideDhaka: number;

  @Column({ type: 'int' })
  outsideDhaka: number;

  /** Free delivery from this amount (after the coupon); 0 = off. */
  @Column({ type: 'int' })
  freeThreshold: number;

  @Column({ type: 'uuid', nullable: true })
  updatedById: string | null;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedById' })
  updatedBy?: Users | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
