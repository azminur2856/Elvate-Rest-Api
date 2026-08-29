import { Verification } from 'src/auth/entities/verification.entity';
import { Role } from 'src/users/enums/role.enum';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ActivityLog } from 'src/activity-logs/entities/activity-logs.entity';
import { Review } from 'src/reviews/entities/review.entity';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { Payment } from 'src/subscription/entities/payment.entity';

@Entity()
export class Users {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastName?: string;

  @Column({ type: 'date', nullable: true })
  dob: Date;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'enum', enum: Role, default: Role.BUYER })
  role: Role;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'boolean', default: false })
  isPhoneVerified: boolean;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    default: 'profile.png',
  })
  profileImage: string;

  @Column({ default: false })
  isFaceVerified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // NOTE: plain `timestamp` (no time zone) — node-pg writes/reads it using the
  // process's local wall-clock, so the process MUST run in UTC on every
  // machine (see src/set-timezone.ts), otherwise a logout recorded on a UTC+6
  // dev box is read by Render (UTC) as 6 h in the future and validateJwtUser()
  // rejects every token with "Token invalid due to logout".
  // (Not switched to `timestamptz`: with synchronize:true TypeORM drops and
  // recreates a column on type change, which would fail on NOT NULL columns.)
  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @Column({
    type: 'timestamp',
    default: () => `'1970-01-01 00:00:00'`,
  })
  lastLogoutAt: Date;

  /////////// RELATIONSHIPS ////////////
  @OneToMany(() => Verification, (verification) => verification.user, {
    cascade: true,
  })
  verifications: Verification[];

  @OneToMany(() => ActivityLog, (activityLogs) => activityLogs.user)
  activityLogs: ActivityLog[];

  @OneToMany(() => Review, (review) => review.user, { cascade: true }) // One user can have many reviews.
  reviews: Review[];

  @OneToMany(() => Subscription, (subscription) => subscription.user)
  subscriptions: Subscription[];

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];

  /////// Before insert //////
  @BeforeInsert()
  emailToLowerCase() {
    if (this.email) {
      this.email = this.email.toLowerCase();
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }
}
