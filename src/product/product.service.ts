import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create_product.dto';
import { UpdateProductDto } from './dto/update_product.dto';
import { ProductLog } from './entities/product_logs.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,

    @InjectRepository(ProductLog)
    private logRepository: Repository<ProductLog>,
  ) {}

  // async createProduct(createProductDto: CreateProductDto): Promise<Product> {
  //   const product = this.productRepository.create(createProductDto);
  //   return this.productRepository.save(product);
  // }

  // product.service.ts
  async createProduct(dto: CreateProductDto, user: any): Promise<Product> {
    const product = this.productRepository.create({
      ...dto,
      createdBy: { id: user.userId }, // TypeORM will handle the relation
    });

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
      relations: ['variants', 'images', 'category', 'createdBy'],
    });
  }
  async findOneProduct(id: number): Promise<Product> {
    const product = await this.productRepository.findOne({
      relations: ['variants', 'images', 'category', 'createdBy'],
      where: { id },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  // async updateProduct(
  //   id: number,
  //   updateProductDto: UpdateProductDto,
  // ): Promise<{ message: string; product: Product }> {
  //   const product = await this.productRepository.findOneBy({ id });

  //   if (!product) {
  //     throw new NotFoundException(`Product with ID ${id} not found`);
  //   }

  //   Object.assign(product, updateProductDto);
  //   const updatedProduct = await this.productRepository.save(product);

  //   return {
  //     message: `Product with ID ${id} successfully updated`,
  //     product: updatedProduct,
  //   };
  // }

  async updateProduct(
    id: number,
    updateDto: UpdateProductDto,
    user: any,
  ): Promise<{ message: string; product: Product }> {
    const product = await this.productRepository.findOneBy({ id });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const previousState = { ...product }; // store the old state

    Object.assign(product, updateDto);
    product.updated_by = user.userId;
    const updatedProduct = await this.productRepository.save(product);

    // Log the update
    await this.logRepository.save({
      product_id: id,
      action: 'update',
      previous_state: previousState,
      new_state: updatedProduct,
      performed_by: user.userId,
      performed_by_role: user.role,
    });

    return {
      message: `Product with ID ${id} successfully updated`,
      product: updatedProduct,
    };
  }

  async removeProduct(id: number, user: any): Promise<{ message: string }> {
    const product = await this.productRepository.findOneBy({ id });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const previousState = { ...product }; // Save product state before deletion

    await this.productRepository.delete(id);

    // Log the deletion
    await this.logRepository.save({
      product_id: id,
      action: 'delete',
      previous_state: previousState,
      new_state: null,
      performed_by: user.userId,
      performed_by_role: user.role,
    });

    return {
      message: `Product with ID ${id} successfully deleted`,
    };
  }
}
