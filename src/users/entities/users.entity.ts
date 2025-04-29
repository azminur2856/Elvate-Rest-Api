import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Roles } from './roles.entity';
import { Order } from '../../orders/entities/order.entity';
import { Address } from './address.entity';

@Entity()
export class Users {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastName?: string;

  @Column({ nullable: true })
  dob: Date;

  @Column({ 
    type: 'varchar', 
    length: 255, 
    unique: true,
    comment: 'User email address'
  })
  email: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @ManyToMany(() => Roles, (role) => role.users)
  @JoinTable()
  roles: Roles[];

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'boolean', default: false })
  isPhoneVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refreshToken: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    default: 'profile.jpg',
  })
  profileImage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;
}
