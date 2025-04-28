// import { Injectable, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { UserCart } from './entities/user_cart.entity'; // Ensure the path is correct
// import { CreateUserCartDto } from './dto/create_user_cart.dto';
// import { UpdateUserCartDto } from './dto/update_user_cart.dto';

// @Injectable()
// export class CartService {
//   constructor(
//     @InjectRepository(UserCart)
//     private userCartRepository: Repository<UserCart>,
//   ) {}

//   // Fetch all items in the user's cart
//   async findAllUserCartItems(): Promise<UserCart[]> {
//     return this.userCartRepository.find();
//   }

//   // Create a new item in the cart
//   async createUserCart(
//     createUserCartDto: CreateUserCartDto,
//   ): Promise<UserCart> {
//     const cartItem = this.userCartRepository.create(createUserCartDto);
//     return this.userCartRepository.save(cartItem);
//   }

//   // Fetch a specific cart item by ID
//   async findOneUserCartItem(id: number): Promise<UserCart> {
//     const cartItem = await this.userCartRepository.findOne({ where: { id } });
//     if (!cartItem) {
//       throw new NotFoundException(`Cart item with ID ${id} not found`);
//     }
//     return cartItem;
//   }

//   // Update an existing cart item by ID
//   async updateUserCart(
//     id: number,
//     updateUserCartDto: UpdateUserCartDto,
//   ): Promise<{ message: string; cartItem: UserCart }> {
//     const cartItem = await this.userCartRepository.findOne({ where: { id } });

//     if (!cartItem) {
//       throw new NotFoundException(`Cart item with ID ${id} not found`);
//     }

//     Object.assign(cartItem, updateUserCartDto);
//     const updatedCartItem = await this.userCartRepository.save(cartItem);

//     return {
//       message: `Cart item with ID ${id} successfully updated`,
//       cartItem: updatedCartItem,
//     };
//   }

//   // Remove a cart item by ID
//   async removeUserCart(id: number): Promise<{ message: string }> {
//     const cartItem = await this.userCartRepository.findOne({ where: { id } });

//     if (!cartItem) {
//       throw new NotFoundException(`Cart item with ID ${id} not found`);
//     }

//     await this.userCartRepository.delete(id);

//     return {
//       message: `Cart item with ID ${id} successfully deleted`,
//     };
//   }
// }

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

  // Add or update cart item using the DTO
  async addOrUpdateCartItem(
    createUserCartDto: CreateUserCartDto,
  ): Promise<UserCart> {
    const { user_id, variant_id, quantity } = createUserCartDto;

    // Check if the product variant exists
    const variant = await this.productVariantRepository.findOne({
      where: { id: variant_id },
    });
    if (!variant) {
      throw new NotFoundException(
        `Product variant with ID ${variant_id} not found`,
      );
    }

    // Check if the item already exists in the cart for the user
    let cartItem = await this.userCartRepository.findOne({
      where: { user_id, variant_id },
    });

    if (cartItem) {
      // If it exists, update the quantity
      cartItem.quantity += quantity;
      return this.userCartRepository.save(cartItem);
    }

    // If it doesn't exist, create a new cart item
    cartItem = this.userCartRepository.create({
      user_id,
      variant_id,
      quantity,
    });

    return this.userCartRepository.save(cartItem);
  }

  // Update cart item quantity
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

  // Remove cart item
  async removeCartItem(id: number): Promise<{ message: string }> {
    const cartItem = await this.userCartRepository.findOne({ where: { id } });
    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${id} not found`);
    }

    await this.userCartRepository.delete(id);
    return { message: `Cart item with ID ${id} successfully deleted` };
  }

  // View cart with item details
  async getCartItems(userId: number): Promise<any> {
    const cartItems = await this.userCartRepository.find({
      where: { user_id: userId },
      relations: ['variant'], // Include variant details
    });

    let totalCost = 0;
    const cartDetails = cartItems.map((item) => {
      const cost = item.variant.price * item.quantity; // Assuming variant has a price field
      totalCost += cost;

      return {
        product: item.variant.product_id, // Assuming the ProductVariant entity has a reference to Product
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

  // Increase cart item quantity by 1
  async increaseCartItemQuantity(
    id: number,
  ): Promise<{ cartItem: UserCart; message: string }> {
    const cartItem = await this.userCartRepository.findOne({ where: { id } });
    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${id} not found`);
    }

    const oldQuantity = cartItem.quantity;
    cartItem.quantity += 1; // Increment by 1
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
