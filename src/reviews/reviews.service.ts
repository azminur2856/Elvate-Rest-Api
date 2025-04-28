import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { Repository } from 'typeorm';
import { Users } from 'src/users/entities/users.entity';
import { CreateReviewDto } from './dto/review.dto';
import { ReviewStatus } from './enums/review-status.enum';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private reviewsRepository: Repository<Review>,
    @InjectRepository(Users) private usersRepository: Repository<Users>,
  ) {}

  async addReview(createReviewDto: CreateReviewDto): Promise<Review> {
    const { userId, productId, rating, comment, reviewStatus } =
      createReviewDto;
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    // const product = await this.productsRepository.findOne({
    //   where: { id: productId },
    // });
    // if (!product) {
    //   throw new NotFoundException(`Product with id ${productId} not found`);
    // }

    // Create the review
    const review = this.reviewsRepository.create({
      rating,
      comment,
      reviewStatus,
      user,
      //product,
    });

    return await this.reviewsRepository.save(review);
  }

  async removeReview(reviewId: number, userId: string): Promise<string> {
    const review = await this.reviewsRepository.findOne({
      where: { id: reviewId },
      relations: ['user'],
    });

    if (!review) {
      throw new NotFoundException(`Review with id ${reviewId} not found`);
    }

    // Check if the review belongs to the current user or if the user is an admin
    // if (review.user.id !== userId) {
    //     throw new BadRequestException('You are not authorized to delete this review');
    // }

    // Delete the review
    await this.reviewsRepository.delete(reviewId);

    return `Review with id ${reviewId} has been deleted successfully`;
  }

  async changeReviewStatus(reviewId: number, status: number): Promise<Review> {
    if (status !== 1 && status !== 0) {
      throw new BadRequestException(
        'Invalid status value. Use 1 for ACCEPTED and 0 for REJECTED.',
      );
    }

    const review = await this.reviewsRepository.findOne({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException(`Review with id ${reviewId} not found`);
    }

    review.reviewStatus =
      status === 1 ? ReviewStatus.APPROVED : ReviewStatus.REJECTED;

    return this.reviewsRepository.save(review);
  }

  async getReviewsByStatus(status: ReviewStatus): Promise<Review[]> {
    if (!Object.values(ReviewStatus).includes(status)) {
      throw new NotFoundException('Invalid review status');
    }
    return this.reviewsRepository.find({ where: { reviewStatus: status } });
  }

  async getAllReviews(): Promise<Review[]> {
    return this.reviewsRepository.find();
  }
}
