import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { Product } from 'src/products/entities/product.entity';
import { ProductImage } from 'src/products/entities/product-image.entity';
import { ReviewsService } from './reviews.service';
import {
  AdminReviewsController,
  ProductReviewsController,
  ReviewsController,
} from './reviews.controller';
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Product, ProductImage]),
    ActivityLogsModule,
  ],
  controllers: [
    ProductReviewsController,
    ReviewsController,
    AdminReviewsController,
  ],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
