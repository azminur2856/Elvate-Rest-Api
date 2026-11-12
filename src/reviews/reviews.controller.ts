import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import {
  AdminReviewsQueryDto,
  CreateReviewDto,
  FeaturedQueryDto,
  ModerateReviewDto,
} from './dto/review.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SHOP_MANAGER_ROLES } from 'src/users/enums/role.enum';
import { PaginationQueryDto } from 'src/common/pagination';
import type { AuthRequest } from 'src/common/auth-user';

/** Reviews attached to a product page (BE-19). */
@ApiTags('Reviews')
@Controller('products')
export class ProductReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get(':slug/reviews')
  list(@Param('slug') slug: string, @Query() query: PaginationQueryDto) {
    return this.reviews.forProduct(slug, query);
  }

  @Get(':slug/reviews/eligibility')
  eligibility(@Param('slug') slug: string, @Req() req: AuthRequest) {
    return this.reviews.eligibility(req.user.id, slug);
  }

  @Post(':productId/reviews')
  create(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateReviewDto,
    @Req() req: AuthRequest,
  ) {
    return this.reviews.create(req.user, productId, dto);
  }
}

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('my')
  mine(@Query() query: PaginationQueryDto, @Req() req: AuthRequest) {
    return this.reviews.mine(req.user.id, query);
  }

  /** Home page: approved, 4★+, with a comment, newest first. */
  @Public()
  @Get('featured')
  featured(@Query() query: FeaturedQueryDto) {
    return this.reviews.featured(query.limit ?? 10);
  }

  /** Owner or ADMIN. */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.reviews.remove(req.user, id);
  }
}

/** Moderation queue: ADMIN and STAFF. */
@ApiTags('Admin · Reviews')
@Roles(...SHOP_MANAGER_ROLES)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Query() query: AdminReviewsQueryDto) {
    return this.reviews.adminList(query);
  }

  @Patch(':id/status')
  moderate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModerateReviewDto,
    @Req() req: AuthRequest,
  ) {
    return this.reviews.moderate(req.user, id, dto.status);
  }
}
