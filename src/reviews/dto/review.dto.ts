import { IsInt, IsOptional, IsString, IsEnum, Min, Max } from 'class-validator';
import { ReviewStatus } from '../enums/review-status.enum';

export class CreateReviewDto {
  @IsInt()
  userId: number;

  @IsInt()
  productId: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsEnum(ReviewStatus)
  @IsOptional()
  reviewStatus: ReviewStatus = ReviewStatus.PENDING;
}
