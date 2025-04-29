import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Users } from 'src/users/entities/users.entity';
import { ReviewStatus } from '../enums/review-status.enum';

@Entity({ name: 'reviews' })
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'smallint' }) // Rating of the product, between 1-5.
  rating: number;

  @Column({ type: 'text', nullable: true }) // Optional comment with the review.
  comment?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING }) // Enum for review status.
  reviewStatus: ReviewStatus;

  ////////// RELATIONSHIPS //////////
  @ManyToOne(() => Users, (user) => user.reviews, {
    nullable: true,
    onDelete: 'SET NULL', // Set null on delete
  }) // Many reviews can belong to one user.
  @JoinColumn()
  user: Users;
}
