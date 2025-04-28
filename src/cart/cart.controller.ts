import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CreateUserCartDto } from './dto/create_user_cart.dto';
import { UpdateUserCartDto } from './dto/update_user_cart.dto';
import { CartService } from './cart.service';

@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  // Get all items in the user's cart
  @Get(':userId')
  async getCartItems(@Param('userId') userId: number) {
    return this.cartService.getCartItems(userId);
  }

  // Add or update a cart item
  @Post()
  async addOrUpdateCartItem(@Body() createUserCartDto: CreateUserCartDto) {
    return this.cartService.addOrUpdateCartItem(createUserCartDto);
  }

  // Update an existing cart item quantity
  @Put(':id')
  async updateCartItem(
    @Param('id') id: number,
    @Body() updateUserCartDto: UpdateUserCartDto,
  ) {
    return this.cartService.updateCartItem(id, updateUserCartDto);
  }

  // Remove a cart item
  @Delete(':id')
  async removeCartItem(@Param('id') id: number) {
    return this.cartService.removeCartItem(id);
  }

  // Increase the quantity of a cart item by 1
  @Put(':id/increase')
  async increaseCartItemQuantity(@Param('id') id: number) {
    return this.cartService.increaseCartItemQuantity(id);
  }

  // Decrease the quantity of a cart item by 1
  @Put(':id/decrease')
  async decreaseCartItemQuantity(@Param('id') id: number) {
    return this.cartService.decreaseCartItemQuantity(id);
  }
}
