import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { CartService } from './cart.service';
import {
  AddCartItemDto,
  GuestCartDto,
  UpdateCartItemDto,
} from './dto/cart.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import type { AuthRequest } from 'src/common/auth-user';

/** Cart (BE-13). Every response is re-priced from the DB. */
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  /** Guest cart (kept in the browser) priced by the server; lines have `id: null`. */
  @Public()
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() dto: GuestCartDto) {
    return this.cart.preview(dto);
  }

  @Get()
  view(@Req() req: AuthRequest) {
    return this.cart.view(req.user.id);
  }

  @Post('items')
  add(@Body() dto: AddCartItemDto, @Req() req: AuthRequest) {
    return this.cart.add(req.user.id, dto);
  }

  @Patch('items/:itemId')
  update(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: AuthRequest,
  ) {
    return this.cart.update(req.user.id, itemId, dto);
  }

  @Delete('items/:itemId')
  remove(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Req() req: AuthRequest,
  ) {
    return this.cart.remove(req.user.id, itemId);
  }

  @Delete()
  clear(@Req() req: AuthRequest) {
    return this.cart.clear(req.user.id);
  }

  /** After login: add the guest cart to the account cart (capped, never a 400 for stock). */
  @Post('merge')
  @HttpCode(HttpStatus.OK)
  merge(@Body() dto: GuestCartDto, @Req() req: AuthRequest) {
    return this.cart.merge(req.user.id, dto);
  }
}
