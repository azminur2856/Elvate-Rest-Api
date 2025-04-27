import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductVariantDto } from './dto/create_product_variant';
import { UpdateProductVariantDto } from './dto/update_product_variant.dto';
import { ProductVariant } from './entities/product_variant.entity';
import { ProductImage } from './entities/product_image.entity';

@Injectable()
export class ProductVariantService {
  constructor(
    @InjectRepository(ProductVariant)
    private productVariantRepository: Repository<ProductVariant>,
  ) {}

  // Create a new product variant
  //   async create(
  //     createProductVariantDto: CreateProductVariantDto,
  //   ): Promise<ProductVariant> {
  //     const productVariant = this.productVariantRepository.create(
  //       createProductVariantDto,
  //     );
  //     return await this.productVariantRepository.save(productVariant);
  //   }

  // Create a new product variant
  async createProductVariant(
    createProductVariantDto: CreateProductVariantDto,
  ): Promise<ProductVariant> {
    const productVariant = this.productVariantRepository.create(
      createProductVariantDto,
    );
    return await this.productVariantRepository.save(productVariant);
  }

  // Find all product variants
  async showAllProductVariant(): Promise<ProductVariant[]> {
    return this.productVariantRepository.find();
  }

  // Find one product variant by id
  async findOneProductVariant(id: number): Promise<ProductVariant> {
    const variant = await this.productVariantRepository.findOne({
      where: { id },
    });
    if (!variant) {
      throw new NotFoundException(`ProductVariant with ID ${id} not found`);
    }
    return variant;
  }

  // Update a product variant by id
  async updateProductVariant(
    id: number,
    updateProductVariantDto: UpdateProductVariantDto,
  ): Promise<{ message: string; variant: ProductVariant }> {
    const variant = await this.productVariantRepository.findOneBy({ id });

    if (!variant) {
      throw new NotFoundException(`ProductVariant with ID ${id} not found`);
    }

    Object.assign(variant, updateProductVariantDto);
    const updatedVariant = await this.productVariantRepository.save(variant);

    return {
      message: `ProductVariant with ID ${id} successfully updated`,
      variant: updatedVariant,
    };
  }

  async removeProductVariant(id: number): Promise<{ message: string }> {
    const variant = await this.productVariantRepository.findOneBy({ id });

    if (!variant) {
      throw new NotFoundException(`ProductVariant with ID ${id} not found`);
    }

    await this.productVariantRepository.delete(id);

    return {
      message: `ProductVariant with ID ${id} successfully deleted`,
    };
  }
}
