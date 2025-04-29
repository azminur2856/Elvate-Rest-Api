import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create_product.dto';
import { UpdateProductDto } from './dto/update_product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product) private productRepository: Repository<Product>,
  ) {}

  async createProduct(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create(createProductDto);
    return this.productRepository.save(product);
  }

  // async createProduct(
  //   createProductDto: CreateProductDto & { created_by: number },
  // ): Promise<Product> {
  //   const product = this.productRepository.create(createProductDto);

  //   return this.productRepository.save(product);
  // }

  async findAllProduct(): Promise<Product[]> {
    return this.productRepository.find({
      relations: ['variants', 'images', 'category'],
    });
  }
  async findOneProduct(id: number): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async updateProduct(
    id: number,
    updateProductDto: UpdateProductDto,
  ): Promise<{ message: string; product: Product }> {
    const product = await this.productRepository.findOneBy({ id });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    Object.assign(product, updateProductDto);
    const updatedProduct = await this.productRepository.save(product);

    return {
      message: `Product with ID ${id} successfully updated`,
      product: updatedProduct,
    };
  }

  async removeProduct(id: number): Promise<{ message: string }> {
    const product = await this.productRepository.findOneBy({ id });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.productRepository.delete(id);

    return {
      message: `Product with ID ${id} successfully deleted`,
    };
  }
}
