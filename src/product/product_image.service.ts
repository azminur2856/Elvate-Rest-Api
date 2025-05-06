import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductImageDto } from './dto/create_product_image.dto';
import { UpdateProductImageDto } from './dto/update_product_image.dto';
import { ProductImage } from './entities/product_image.entity';

@Injectable()
export class ProductImageService {
  constructor(
    @InjectRepository(ProductImage)
    private productImageRepository: Repository<ProductImage>,
  ) {}

  async createProductImage(
    createProductImageDto: CreateProductImageDto,
  ): Promise<ProductImage> {
    const productImage = this.productImageRepository.create(
      createProductImageDto,
    );

    return this.productImageRepository.save(productImage);
  }

  // async createProductImage(dto: CreateProductImageDto): Promise<ProductImage> {
  //   const productImage = this.productImageRepository.create(dto);
  //   return this.productImageRepository.save(productImage);
  // }

  async showAllProductImages(): Promise<ProductImage[]> {
    return this.productImageRepository.find({
      relations: ['product', 'variant'],
    });
  }

  async findOneProductImage(id: number): Promise<ProductImage> {
    const image = await this.productImageRepository.findOne({ where: { id } });
    if (!image) {
      throw new NotFoundException(`ProductImage with ID ${id} not found`);
    }
    return image;
  }

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
