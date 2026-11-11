import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import {
  FiltersQueryDto,
  ProductListQueryDto,
  RelatedQueryDto,
} from './dto/product-query.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import { OptionalAuth } from 'src/auth/decorators/optional-auth.decorator';
import type { AuthUser } from 'src/common/auth-user';

/** Public catalog (BE-11). Only active products are visible to shoppers. */
@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get()
  list(@Query() query: ProductListQueryDto) {
    return this.catalog.list(query);
  }

  // Declared before ':slug' so "filters" is not taken for a slug.
  @Public()
  @Get('filters')
  filters(@Query() query: FiltersQueryDto) {
    return this.catalog.filters(query.category);
  }

  /** Inactive products 404 for shoppers; ADMIN/STAFF see them (OptionalAuth). */
  @OptionalAuth()
  @Get(':slug')
  detail(@Param('slug') slug: string, @Req() req: { user?: AuthUser }) {
    return this.catalog.detailBySlug(slug, req.user);
  }

  @Public()
  @Get(':slug/related')
  related(@Param('slug') slug: string, @Query() query: RelatedQueryDto) {
    return this.catalog.related(slug, query.limit ?? 8);
  }
}
