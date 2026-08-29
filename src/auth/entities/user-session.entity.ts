import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Users } from 'src/users/entities/users.entity';

/**
 * One row per login ("device"). Both JWTs issued for a login carry this row's
 * id as `sid`; the refresh token is validated against `hashedRefreshToken` of
 * that row only, so logging in on a second device no longer invalidates the
 * first. Logging out deletes just this row; password change/reset deletes all
 * rows for the user (see AuthService.logoutAll).
 */
@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Users;

  /** argon2 hash of the refresh token currently valid for this session. */
  @Column({ type: 'varchar', length: 255 })
  hashedRefreshToken: string;

  /** 'localLogin' | 'googleOAuth' | 'faceLogin' */
  @Column({ type: 'varchar', length: 32 })
  loginMethod: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;

  /** Updated on every successful refresh. */
  @Column({ type: 'timestamp' })
  lastUsedAt: Date;

  /** Hard cap on the session's life, regardless of refreshes. */
  @Column({ type: 'timestamp' })
  @Index()
  expiresAt: Date;
}
