import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Failed sign-in attempts per (scope, key), e.g. ('face-email', 'a@b.c') or
 * ('face-ip', '1.2.3.4'). Kept in the database so a restart or a Render
 * sleep does not reset a lock.
 */
@Entity('login_attempts')
@Index(['scope', 'key'], { unique: true })
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  scope: string;

  @Column({ type: 'varchar', length: 320 })
  key: string;

  /** Failures since `windowStart`. */
  @Column({ type: 'int', default: 0 })
  failures: number;

  @Column({ type: 'timestamptz' })
  windowStart: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
