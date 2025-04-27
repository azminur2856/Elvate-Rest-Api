import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductImageDto } from './dto/create_product_image.dto';
import { UpdateProductImageDto } from './dto/update_product_image.dto';
import { ProductImage } from './product_image.entity';

@Injectable()
export class ProductImageService {
  constructor(
    @InjectRepository(ProductImage)
    private productImageRepository: Repository<ProductImage>,
  ) {}

  // Create a new product image
  async createProductImage(
    createProductImageDto: CreateProductImageDto,
  ): Promise<ProductImage> {
    const productImage = this.productImageRepository.create(
      createProductImageDto,
    );

    return this.productImageRepository.save(productImage);
  }

  // Find all product images
  async showAllProductImages(): Promise<ProductImage[]> {
    return this.productImageRepository.find();
  }

  // Find one product image by id
  async findOneProductImage(id: number): Promise<ProductImage> {
    const image = await this.productImageRepository.findOne({ where: { id } });
    if (!image) {
      throw new NotFoundException(`ProductImage with ID ${id} not found`);
    }
    return image;
  }

  // Update a product image by id
  async updateProductImage(
    id: number,
    updateProductImageDto: UpdateProductImageDto,
  ): Promise<{ message: string; image: ProductImage }> {
    const image = await this.productImageRepository.findOneBy({ id });

    if (!image) {
      throw new NotFoundException(`ProductImage with ID ${id} not found`);
    }

    Object.assign(image, updateProductImageDto);
    const updatedImage = await this.productImageRepository.save(image);

    return {
      message: `ProductImage with ID ${id} successfully updated`,
      image: updatedImage,
    };
  }

  // Delete a product image by id
  async removeProductImage(id: number): Promise<{ message: string }> {
    const image = await this.productImageRepository.findOneBy({ id });

    if (!image) {
      throw new NotFoundException(`ProductImage with ID ${id} not found`);
    }

    await this.productImageRepository.delete(id);

    return {
      message: `ProductImage with ID ${id} successfully deleted`,
    };
  }
}
