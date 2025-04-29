import { Controller, Get, Query, Param } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ProductCategory } from './entities/product.entity';

@ApiTags('C. Public - Product Catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get all products',
    description: 'Retrieves a paginated list of products with optional filtering.'
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    type: Number,
    description: 'Page number for pagination (default: 1)'
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number,
    description: 'Number of items per page (default: 10)'
  })
  @ApiQuery({ 
    name: 'category', 
    required: false, 
    enum: ProductCategory,
    description: 'Filter products by category'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of products retrieved successfully'
  })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('category') category?: ProductCategory,
  ) {
    return this.productsService.findAll(page, limit, category);
  }

  @Get('featured')
  @ApiOperation({ 
    summary: 'Get featured products',
    description: 'Retrieves a list of featured products.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Featured products retrieved successfully'
  })
  getFeatured() {
    return this.productsService.getFeatured();
  }

  @Get('new-arrivals')
  @ApiOperation({ 
    summary: 'Get new arrival products',
    description: 'Retrieves a list of recently added products.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'New arrival products retrieved successfully'
  })
  getNewArrivals() {
    return this.productsService.getNewArrivals();
  }

  @Get('best-sellers')
  @ApiOperation({ 
    summary: 'Get best seller products',
    description: 'Retrieves a list of best selling products.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Best seller products retrieved successfully'
  })
  getBestSellers() {
    return this.productsService.getBestSellers();
  }

  @Get('on-sale')
  @ApiOperation({ 
    summary: 'Get products on sale',
    description: 'Retrieves a list of products currently on sale.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Products on sale retrieved successfully'
  })
  getOnSale() {
    return this.productsService.getOnSale();
  }

  @Get('category/:category')
  @ApiOperation({ 
    summary: 'Get products by category',
    description: 'Retrieves a list of products in a specific category.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Products in category retrieved successfully'
  })
  getByCategory(@Param('category') category: ProductCategory) {
    return this.productsService.getByCategory(category);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get product by ID',
    description: 'Retrieves detailed information about a specific product.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Product found successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Product not found'
  })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }
} 