import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Users } from 'src/users/entities/users.entity';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';

@Entity()
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ActivityType, nullable: false })
  action: ActivityType;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  ////////// RELATIONSHIPS //////////
  @ManyToOne(() => Users, (user) => user.activityLogs, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  user: Users;
}
