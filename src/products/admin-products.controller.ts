import { Controller, Post, Patch, Delete, Body, Param, UseGuards, Get } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/roles.enum';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('F. Admin - Products')
@ApiBearerAuth()
@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product', description: 'Creates a new product. (Admin only)' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product', description: 'Updates an existing product. (Admin only)' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product', description: 'Deletes an existing product. (Admin only)' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Patch(':id/toggle-featured')
  @ApiOperation({ summary: 'Toggle featured status', description: 'Toggles whether a product is featured or not' })
  @ApiResponse({ status: 200, description: 'Featured status toggled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async toggleFeatured(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);
    return this.productsService.update(id, { isFeatured: !product.isFeatured });
  }

  @Patch(':id/toggle-new-arrival')
  @ApiOperation({ summary: 'Toggle new arrival status', description: 'Toggles whether a product is marked as new arrival' })
  @ApiResponse({ status: 200, description: 'New arrival status toggled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async toggleNewArrival(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);
    return this.productsService.update(id, { isNewArrival: !product.isNewArrival });
  }

  @Patch(':id/toggle-best-seller')
  @ApiOperation({ summary: 'Toggle best seller status', description: 'Toggles whether a product is marked as best seller' })
  @ApiResponse({ status: 200, description: 'Best seller status toggled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async toggleBestSeller(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);
    return this.productsService.update(id, { isBestSeller: !product.isBestSeller });
  }

  @Patch(':id/toggle-on-sale')
  @ApiOperation({ summary: 'Toggle on sale status', description: 'Toggles whether a product is on sale' })
  @ApiResponse({ status: 200, description: 'On sale status toggled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async toggleOnSale(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);
    return this.productsService.update(id, { isOnSale: !product.isOnSale });
  }

  @Patch(':id/update-stock')
  @ApiOperation({ summary: 'Update product stock', description: 'Updates the stock quantity of a product. Stock cannot be negative.' })
  @ApiBody({ type: UpdateStockDto })
  @ApiResponse({ status: 200, description: 'Stock updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid stock quantity' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateStock(@Param('id') id: string, @Body() updateStockDto: UpdateStockDto) {
    return this.productsService.updateStock(id, updateStockDto.stockQuantity);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get product analytics', description: 'Retrieves analytics data for all products' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  getAnalytics() {
    return this.productsService.getProductStats();
  }
} 