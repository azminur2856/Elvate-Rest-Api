import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { VerificationType } from 'src/auth/enums/verification-type.enum';
import { Users } from 'src/users/entities/users.entity';

@Entity()
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: VerificationType })
  @Index()
  type: VerificationType;

  @Column({ type: 'varchar', length: 255 })
  tokenOrOtp: string;

  @Column({ type: 'boolean', default: false })
  @Index()
  isUsed: boolean;

  @Column({ type: 'timestamp' })
  @Index()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'uuid' })
  @Index()
  userId: string; // Foreign key to Users table

  ////////// RELATIONSHIPS //////////
  @ManyToOne(() => Users, (user) => user.verifications, {
    nullable: false,
    onDelete: 'CASCADE',
  }) // Many verifications belong to one user
  @JoinColumn({ name: 'userId' })
  user: Users;
}
