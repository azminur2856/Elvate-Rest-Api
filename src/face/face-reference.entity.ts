import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { Users } from 'src/users/entities/users.entity';

/**
 * SEC-04: the private photo face login compares against. Stored in ImageKit
 * with `isPrivateFile: true` (readable only through short-lived signed URLs),
 * never the public profile picture.
 */
@Entity('face_references')
export class FaceReference {
  @PrimaryColumn('uuid')
  userId: string;

  @OneToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: Users;

  @Column({ type: 'varchar', length: 64 })
  fileId: string;

  @Column({ type: 'varchar', length: 512 })
  filePath: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
