import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { ProductService } from '../../products/services/product.service';
import { CreateProductDto } from '../../products/dto/create-product.dto';
import { UpdateProductDto } from '../../products/dto/update-product.dto';
import { ProductQueryDto } from '../../products/dto/product-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from 'src/users/enums/roles.enum';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';
import { Product } from '../../products/entities/product.entity';

/**
 * Controller for managing products from the admin perspective.
 * @class AdminProductController
 * @description Handles administrative operations for product management.
 */
@ApiTags('E. Admin - Products')
@ApiBearerAuth()
@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * Creates a new product.
   * @param createProductDto - Data for creating a new product
   * @returns Promise<Product> - The created product
   */
  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully', type: Product })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid product data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async create(@Body() createProductDto: CreateProductDto): Promise<Product> {
    try {
      return await this.productService.create(createProductDto);
    } catch (error) {
      throw new BadRequestException(`Error creating product: ${error.message}`);
    }
  }

  /**
   * Retrieves all products with optional filtering and pagination.
   * @param queryDto - Query parameters for filtering and pagination
   * @returns Promise<{ data: Product[]; meta: { total: number; page: number; limit: number } }> - Products and pagination metadata
   */
  @Get()
  @ApiOperation({ summary: 'Get all products with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully', type: [Product] })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async findAll(@Query() queryDto: ProductQueryDto) {
    return this.productService.findAll(queryDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get product statistics' })
  @ApiResponse({ status: 200, description: 'Product statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getStats() {
    return this.productService.getProductStats();
  }

  /**
   * Retrieves a product by ID.
   * @param id - Product ID
   * @returns Promise<Product> - The found product
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully', type: Product })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productService.findOne(id);
  }

  /**
   * Updates a product's information.
   * @param id - Product ID
   * @param updateProductDto - Data for updating the product
   * @returns Promise<Product> - The updated product
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully', type: Product })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid update data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    return this.productService.update(id, updateProductDto);
  }

  /**
   * Removes a product.
   * @param id - Product ID
   * @returns Promise<void>
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.productService.remove(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Set product active status' })
  @ApiResponse({ status: 200, description: 'Product status updated successfully', type: Product })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Product> {
    const product = await this.productService.findOne(id);
    return this.productService.toggleActiveStatus(id, !product.isActive);
  }

  @Patch(':id/feature')
  @ApiOperation({ summary: 'Set product featured status' })
  @ApiResponse({ status: 200, description: 'Product featured status updated successfully', type: Product })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async toggleFeatured(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Product> {
    const product = await this.productService.findOne(id);
    return this.productService.toggleFeaturedStatus(id, !product.isFeatured);
  }

  @Patch(':id/new-arrival')
  @ApiOperation({ summary: 'Set product new arrival status' })
  @ApiResponse({ status: 200, description: 'Product new arrival status updated successfully', type: Product })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async toggleNewArrival(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Product> {
    const product = await this.productService.findOne(id);
    return this.productService.toggleNewArrivalStatus(id, !product.isNewArrival);
  }

  @Patch(':id/best-seller')
  @ApiOperation({ summary: 'Set product best seller status' })
  @ApiResponse({ status: 200, description: 'Product best seller status updated successfully', type: Product })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async toggleBestSeller(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Product> {
    const product = await this.productService.findOne(id);
    return this.productService.toggleBestSellerStatus(id, !product.isBestSeller);
  }

  @Patch(':id/on-sale')
  @ApiOperation({ summary: 'Set product on sale status' })
  @ApiResponse({ status: 200, description: 'Product on sale status updated successfully', type: Product })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async toggleOnSale(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Product> {
    const product = await this.productService.findOne(id);
    return this.productService.toggleOnSaleStatus(id, !product.isOnSale);
  }
} 