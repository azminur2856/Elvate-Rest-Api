import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { WishlistService } from './wishlist.service';
import { PaginationQueryDto } from 'src/common/pagination';
import type { AuthRequest } from 'src/common/auth-user';

export class AddWishlistDto {
  @IsUUID()
  productId: string;
}

/** Saved products (Part D stretch). */
@ApiTags('Wishlist')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@Query() query: PaginationQueryDto, @Req() req: AuthRequest) {
    return this.wishlist.list(req.user.id, query);
  }

  @Get('ids')
  ids(@Req() req: AuthRequest) {
    return this.wishlist.ids(req.user.id);
  }

  @Post()
  add(@Body() dto: AddWishlistDto, @Req() req: AuthRequest) {
    return this.wishlist.add(req.user.id, dto.productId);
  }

  @Delete(':productId')
  remove(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Req() req: AuthRequest,
  ) {
    return this.wishlist.remove(req.user.id, productId);
  }
}
