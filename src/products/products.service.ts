import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Product, ProductCategory } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create(createProductDto);
    return await this.productRepository.save(product);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    category?: ProductCategory,
  ): Promise<{ data: Product[]; total: number }> {
    const query = this.productRepository.createQueryBuilder('product');

    if (category) {
      query.where('product.category = :category', { category });
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    return await this.productRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
  }

  async getFeatured(): Promise<Product[]> {
    return await this.productRepository.find({
      where: { isFeatured: true },
      take: 10,
    });
  }

  async getNewArrivals(): Promise<Product[]> {
    return await this.productRepository.find({
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  async getBestSellers(): Promise<Product[]> {
    return await this.productRepository.find({
      where: { isBestSeller: true },
      take: 10,
    });
  }

  async getOnSale(): Promise<Product[]> {
    return await this.productRepository.find({
      where: { isOnSale: true },
      take: 10,
    });
  }

  async getByCategory(category: ProductCategory): Promise<Product[]> {
    const where: FindOptionsWhere<Product> = {
      category: category
    };
    return await this.productRepository.find({ where });
  }

  async getProductStats() {
    const totalProducts = await this.productRepository.count();
    const featuredCount = await this.productRepository.count({ where: { isFeatured: true } });
    const newArrivalsCount = await this.productRepository.count({ where: { isNewArrival: true } });
    const bestSellersCount = await this.productRepository.count({ where: { isBestSeller: true } });
    const onSaleCount = await this.productRepository.count({ where: { isOnSale: true } });

    const categoryCounts = await this.productRepository
      .createQueryBuilder('product')
      .select('product.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('product.category')
      .getRawMany();

    return {
      totalProducts,
      featuredCount,
      newArrivalsCount,
      bestSellersCount,
      onSaleCount,
      categoryCounts,
    };
  }
} 