import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import { Product } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductQueryDto } from '../dto/product-query.dto';
import { ProductCategory } from '../enums/product-category.enum';
import { LessThan } from 'typeorm';

/**
 * Service responsible for managing product-related operations.
 * @class ProductService
 * @description Handles CRUD operations for products, including filtering, pagination, and sorting.
 */
@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Creates a new product.
   * @param createProductDto - Data for creating a new product
   * @returns Promise<Product> - The created product
   * @throws BadRequestException - If product creation fails
   */
  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create(createProductDto);
    return this.productRepository.save(product);
  }

  /**
   * Retrieves all products with optional filtering and pagination.
   * @param query - Query parameters for filtering and pagination
   * @returns Promise<{ data: Product[]; meta: { total: number; page: number; limit: number } }> - Products and pagination metadata
   */
  async findAll(queryDto: ProductQueryDto) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        category, 
        minPrice, 
        maxPrice, 
        size, 
        color, 
        brand, 
        material,
        isFeatured,
        isNewArrival,
        isBestSeller,
        isOnSale,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = queryDto;

      if (isNaN(page) || page < 1) {
        throw new BadRequestException('Page must be a positive number');
      }
      if (isNaN(limit) || limit < 1) {
        throw new BadRequestException('Limit must be a positive number');
      }
      if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
        throw new BadRequestException('Minimum price cannot be greater than maximum price');
      }

      const skip = (page - 1) * limit;
      const queryBuilder = this.productRepository.createQueryBuilder('product');
      queryBuilder.where('1=1');
      
      if (search) {
        queryBuilder.andWhere('(product.name ILIKE :search OR product.description ILIKE :search)', 
          { search: `%${search}%` });
      }

      if (category) {
        queryBuilder.andWhere('product.category = :category', { category });
      }

      if (minPrice !== undefined) {
        queryBuilder.andWhere('CAST(product.price AS DECIMAL) >= :minPrice', { minPrice });
      }
      
      if (maxPrice !== undefined) {
        queryBuilder.andWhere('CAST(product.price AS DECIMAL) <= :maxPrice', { maxPrice });
      }

      if (brand) {
        queryBuilder.andWhere('product.brand ILIKE :brand', { brand: `%${brand}%` });
      }

      if (material) {
        queryBuilder.andWhere('product.material ILIKE :material', { material: `%${material}%` });
      }

      if (isFeatured !== undefined) {
        queryBuilder.andWhere('product.isFeatured = :isFeatured', { isFeatured });
      }

      if (isNewArrival !== undefined) {
        queryBuilder.andWhere('product.isNewArrival = :isNewArrival', { isNewArrival });
      }

      if (isBestSeller !== undefined) {
        queryBuilder.andWhere('product.isBestSeller = :isBestSeller', { isBestSeller });
      }

      if (isOnSale !== undefined) {
        queryBuilder.andWhere('product.isOnSale = :isOnSale', { isOnSale });
      }
      
      if (size) {
        queryBuilder.andWhere(':size = ANY(product.sizes)', { size });
      }
      
      if (color) {
        queryBuilder.andWhere(':color = ANY(product.colors)', { color });
      }
      
      const validSortFields = [
        'name', 'price', 'createdAt', 'updatedAt', 
        'stockQuantity', 'viewCount', 'rating'
      ];
      
      const validSortOrder = ['asc', 'desc'];
      
      const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const finalSortOrder = validSortOrder.includes(sortOrder.toLowerCase()) 
        ? sortOrder.toLowerCase() 
        : 'desc';
      
      queryBuilder.orderBy(`product.${finalSortBy}`, finalSortOrder.toUpperCase() as 'ASC' | 'DESC');
      queryBuilder.skip(skip).take(limit);
      
      const [items, total] = await queryBuilder.getManyAndCount();

      if (total === 0) {
        return {
          items: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
            message: 'No products found matching the criteria'
          },
        };
      }

      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error processing product query: ' + error.message);
    }
  }

  /**
   * Retrieves a product by its ID.
   * @param id - Product ID
   * @returns Promise<Product> - The found product
   * @throws NotFoundException - If product is not found
   */
  async findOne(id: string): Promise<Product> {
    try {
      const product = await this.productRepository.findOne({ where: { id } });
      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      return product;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error finding product: ${error.message}`);
    }
  }

  /**
   * Updates a product by its ID.
   * @param id - Product ID
   * @param updateProductDto - Data for updating the product
   * @returns Promise<Product> - The updated product
   * @throws NotFoundException - If product is not found
   * @throws BadRequestException - If update fails
   */
  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    try {
      const product = await this.findOne(id);
      Object.assign(product, updateProductDto);
      return this.productRepository.save(product);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error updating product: ${error.message}`);
    }
  }

  /**
   * Removes a product by its ID.
   * @param id - Product ID
   * @returns Promise<void>
   * @throws NotFoundException - If product is not found
   * @throws BadRequestException - If deletion fails
   */
  async remove(id: string): Promise<void> {
    try {
      const result = await this.productRepository.delete(id);
      if (result.affected === 0) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error removing product: ${error.message}`);
    }
  }

  async toggleActiveStatus(id: string, isActive: boolean): Promise<Product> {
    try {
      const product = await this.findOne(id);
      product.isActive = isActive;
      return this.productRepository.save(product);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error toggling product status: ${error.message}`);
    }
  }

  async toggleFeaturedStatus(id: string, isFeatured: boolean): Promise<Product> {
    try {
      const product = await this.findOne(id);
      product.isFeatured = isFeatured;
      return this.productRepository.save(product);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error toggling product featured status: ${error.message}`);
    }
  }

  async toggleNewArrivalStatus(id: string, isNewArrival: boolean): Promise<Product> {
    try {
      const product = await this.findOne(id);
      product.isNewArrival = isNewArrival;
      return this.productRepository.save(product);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error toggling product new arrival status: ${error.message}`);
    }
  }

  async toggleBestSellerStatus(id: string, isBestSeller: boolean): Promise<Product> {
    try {
      const product = await this.findOne(id);
      product.isBestSeller = isBestSeller;
      return this.productRepository.save(product);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error toggling product best seller status: ${error.message}`);
    }
  }

  async toggleOnSaleStatus(id: string, isOnSale: boolean): Promise<Product> {
    try {
      const product = await this.findOne(id);
      product.isOnSale = isOnSale;
      return this.productRepository.save(product);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error toggling product on sale status: ${error.message}`);
    }
  }

  async getProductStats() {
    try {
      // Get total products count
      const totalProducts = await this.productRepository.count();
      
      // Get active products count
      const activeProducts = await this.productRepository.count({ where: { isActive: true } });
      
      // Get out of stock products count
      const outOfStock = await this.productRepository.count({ where: { stockQuantity: 0 } });
      
      // Get low stock products count (less than 10)
      const lowStock = await this.productRepository.count({ where: { stockQuantity: LessThan(10) } });
      
      // Get products by category
      const byCategory = await this.productRepository
        .createQueryBuilder('product')
        .select('product.category', 'category')
        .addSelect('COUNT(*)', 'count')
        .groupBy('product.category')
        .getRawMany();
      
      // Get top selling products (by view count)
      const topSelling = await this.productRepository
        .createQueryBuilder('product')
        .where('product.isActive = :isActive', { isActive: true })
        .orderBy('product.viewCount', 'DESC')
        .take(5)
        .getMany();
      
      // Get recently added products
      const recentAdded = await this.productRepository
        .createQueryBuilder('product')
        .where('product.isActive = :isActive', { isActive: true })
        .orderBy('product.createdAt', 'DESC')
        .take(5)
        .getMany();
      
      return {
        totalProducts,
        activeProducts,
        outOfStock,
        lowStock,
        byCategory,
        topSelling,
        recentAdded
      };
    } catch (error) {
      throw new BadRequestException(`Error getting product statistics: ${error.message}`);
    }
  }

  async getFeaturedProducts(limit: number = 10): Promise<Product[]> {
    try {
      return await this.productRepository.find({
        where: { isFeatured: true, isActive: true },
        take: limit,
      });
    } catch (error) {
      return [];
    }
  }

  async getNewArrivals(limit: number = 10): Promise<Product[]> {
    try {
      return await this.productRepository.find({
        where: { isNewArrival: true, isActive: true },
        take: limit,
      });
    } catch (error) {
      return [];
    }
  }

  async getBestSellers(limit: number = 10): Promise<Product[]> {
    try {
      return await this.productRepository.find({
        where: { isBestSeller: true, isActive: true },
        take: limit,
      });
    } catch (error) {
      return [];
    }
  }

  async getOnSaleProducts(limit: number = 10): Promise<Product[]> {
    try {
      return await this.productRepository.find({
        where: { isOnSale: true, isActive: true },
        take: limit,
      });
    } catch (error) {
      return [];
    }
  }

  async getProductsByCategory(category: ProductCategory, limit: number = 10): Promise<Product[]> {
    try {
      return await this.productRepository.find({
        where: { category, isActive: true },
        take: limit,
      });
    } catch (error) {
      return [];
    }
  }

  async incrementViewCount(id: string): Promise<Product> {
    try {
      const product = await this.findOne(id);
      product.viewCount += 1;
      return this.productRepository.save(product);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error incrementing view count: ${error.message}`);
    }
  }

  async findFeatured() {
    return this.productRepository.find({
      where: { isFeatured: true },
      take: 10,
    });
  }

  async findNewArrivals() {
    return this.productRepository.find({
      where: { isNewArrival: true },
      take: 10,
    });
  }

  async findBestSellers() {
    return this.productRepository.find({
      where: { isBestSeller: true },
      take: 10,
    });
  }

  async findOnSale() {
    return this.productRepository.find({
      where: { isOnSale: true },
      take: 10,
    });
  }

  async findByCategory(category: string) {
    return this.productRepository.find({
      where: { category: category as ProductCategory },
    });
  }
} 