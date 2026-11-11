import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Users } from 'src/users/entities/users.entity';

/**
 * Saved delivery address. Orders copy it into a JSON snapshot, so editing or
 * deleting an address never changes a past order. The partial unique index
 * guarantees at most one default per user.
 */
@Entity('address')
@Index('UQ_address_one_default_per_user', ['userId'], {
  unique: true,
  where: '"isDefault" = true',
})
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Users;

  /** e.g. "Home", "Office" */
  @Column({ type: 'varchar', length: 40, nullable: true })
  label: string | null;

  @Column({ type: 'varchar', length: 120 })
  fullName: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 300 })
  addressLine: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  area: string | null;

  @Column({ type: 'varchar', length: 80 })
  city: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postalCode: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
