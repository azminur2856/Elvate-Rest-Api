import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from '../services/product.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductQueryDto } from '../dto/product-query.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';
import { ProductCategory } from '../enums/product-category.enum';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/users/enums/roles.enum';

/**
 * Controller handling public product catalog operations.
 */
@ApiTags('C. Public - Product Catalog')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * Creates a new product.
   * @param createProductDto - Data for creating a new product
   * @returns Promise<Product> - The created product
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  /**
   * Retrieves all products with optional filtering.
   * @param query - Query parameters for filtering and pagination
   * @returns Promise<{ data: Product[]; meta: { total: number; page: number; limit: number } }> - Products and pagination metadata
   */
  @Get()
  @ApiOperation({ summary: 'Get all products with optional filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of products retrieved successfully' })
  async findAll(@Query() query: ProductQueryDto) {
    return this.productService.findAll(query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured products' })
  @ApiResponse({ status: 200, description: 'List of featured products retrieved successfully' })
  async findFeatured() {
    return this.productService.findFeatured();
  }

  @Get('new-arrivals')
  @ApiOperation({ summary: 'Get new arrival products' })
  @ApiResponse({ status: 200, description: 'List of new arrival products retrieved successfully' })
  async findNewArrivals() {
    return this.productService.findNewArrivals();
  }

  @Get('best-sellers')
  @ApiOperation({ summary: 'Get best seller products' })
  @ApiResponse({ status: 200, description: 'List of best seller products retrieved successfully' })
  async findBestSellers() {
    return this.productService.findBestSellers();
  }

  @Get('on-sale')
  @ApiOperation({ summary: 'Get products on sale' })
  @ApiResponse({ status: 200, description: 'List of products on sale retrieved successfully' })
  async findOnSale() {
    return this.productService.findOnSale();
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Get products by category' })
  @ApiResponse({ status: 200, description: 'List of products in category retrieved successfully' })
  async findByCategory(@Param('category') category: string) {
    return this.productService.findByCategory(category);
  }

  /**
   * Retrieves a product by its ID.
   * @param id - Product ID
   * @returns Promise<Product> - The found product
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  /**
   * Updates a product by its ID.
   * @param id - Product ID
   * @param updateProductDto - Data for updating the product
   * @returns Promise<Product> - The updated product
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  /**
   * Removes a product by its ID.
   * @param id - Product ID
   * @returns Promise<void>
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
} 