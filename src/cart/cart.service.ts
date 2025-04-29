import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserCartDto } from './dto/create_user_cart.dto';
import { UpdateUserCartDto } from './dto/update_user_cart.dto';
import { ProductVariant } from 'src/product/entities/product_variant.entity';
import { UserCart } from './entities/user_cart.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(UserCart)
    private userCartRepository: Repository<UserCart>,

    @InjectRepository(ProductVariant)
    private productVariantRepository: Repository<ProductVariant>,
  ) {}

  async addOrUpdateCartItem(
    createUserCartDto: CreateUserCartDto,
  ): Promise<UserCart> {
    const { user_id, variant_id, quantity } = createUserCartDto;

    const variant = await this.productVariantRepository.findOne({
      where: { id: variant_id },
    });
    if (!variant) {
      throw new NotFoundException(
        `Product variant with ID ${variant_id} not found`,
      );
    }

    let cartItem = await this.userCartRepository.findOne({
      where: { user_id, variant_id },
    });

    if (cartItem) {
      cartItem.quantity += quantity;
      return this.userCartRepository.save(cartItem);
    }

    cartItem = this.userCartRepository.create({
      user_id,
      variant_id,
      quantity,
    });

    return this.userCartRepository.save(cartItem);
  }

  async updateCartItem(
    id: number,
    updateUserCartDto: UpdateUserCartDto,
  ): Promise<UserCart> {
    const cartItem = await this.userCartRepository.findOne({ where: { id } });
    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${id} not found`);
    }

    cartItem.quantity = updateUserCartDto.quantity;
    return this.userCartRepository.save(cartItem);
  }

  async removeCartItem(id: number): Promise<{ message: string }> {
    const cartItem = await this.userCartRepository.findOne({ where: { id } });
    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${id} not found`);
    }

    await this.userCartRepository.delete(id);
    return { message: `Cart item with ID ${id} successfully deleted` };
  }

  async getCartItems(userId: number): Promise<any> {
    const cartItems = await this.userCartRepository.find({
      where: { user_id: userId },
      relations: ['variant'],
    });

    let totalCost = 0;
    const cartDetails = cartItems.map((item) => {
      const cost = item.variant.price * item.quantity;
      totalCost += cost;

      return {
        product: item.variant.product_id,
        variant: item.variant,
        quantity: item.quantity,
        totalCost: cost,
      };
    });

    return {
      cartItems: cartDetails,
      totalCost,
    };
  }

  async increaseCartItemQuantity(
    id: number,
  ): Promise<{ cartItem: UserCart; message: string }> {
    const cartItem = await this.userCartRepository.findOne({ where: { id } });
    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${id} not found`);
    }

    const oldQuantity = cartItem.quantity;
    cartItem.quantity += 1;
    const updatedCartItem = await this.userCartRepository.save(cartItem);

    return {
      cartItem: updatedCartItem,
      message: `Quantity increased from ${oldQuantity} to ${updatedCartItem.quantity}`,
    };
  }

  async decreaseCartItemQuantity(
    id: number,
  ): Promise<{ cartItem: UserCart; message: string }> {
    const cartItem = await this.userCartRepository.findOne({ where: { id } });
    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${id} not found`);
    }

    const oldQuantity = cartItem.quantity;

    if (cartItem.quantity > 1) {
      cartItem.quantity -= 1; // Decrement by 1 if quantity > 1
    } else {
      throw new BadRequestException(`Cannot decrease quantity below 1`);
    }

    const updatedCartItem = await this.userCartRepository.save(cartItem);

    return {
      cartItem: updatedCartItem,
      message: `Quantity decreased from ${oldQuantity} to ${updatedCartItem.quantity}`,
    };
  }
}
