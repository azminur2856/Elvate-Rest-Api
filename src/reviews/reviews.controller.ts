import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { Public } from 'src/auth/decorators/public.decorator';
import { ReviewStatus } from './enums/review-status.enum';
import { CreateReviewDto } from './dto/review.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/users/enums/role.enum';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get('status')
  async getReviews(@Query('status') status?: string) {
    if (status) {
      const reviewStatus = status.toUpperCase() as ReviewStatus;
      return this.reviewsService.getReviewsByStatus(reviewStatus);
    } else {
      return this.reviewsService.getAllReviews();
    }
  }

  @Public()
  @Post('add')
  async addReview(@Body() createReviewDto: CreateReviewDto) {
    return this.reviewsService.addReview(createReviewDto);
  }

  @Public()
  @Delete('remove/:reviewId')
  async removeReview(@Param('reviewId') reviewId: number, @Req() req) {
    return this.reviewsService.removeReview(reviewId, req.user.id);
  }

  @Roles(Role.ADMIN)
  @Patch('changeStatus/:reviewId')
  async changeReviewStatus(
    @Param('reviewId') reviewId: number,
    @Body('status') status: number, // 1 for ACCEPTED, 0 for REJECTED
  ) {
    return this.reviewsService.changeReviewStatus(reviewId, status);
  }
}
