import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { FaceAction } from 'src/users/services/face-check';

/**
 * SEC-04 liveness: a random prompt issued before a face login. One use,
 * two minutes, bound to the e-mail it was issued for.
 */
@Entity('face_login_challenges')
export class FaceLoginChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Lower-cased e-mail the challenge was issued for. */
  @Column({ type: 'varchar', length: 320 })
  email: string;

  @Column({ type: 'varchar', length: 16 })
  action: FaceAction;

  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
