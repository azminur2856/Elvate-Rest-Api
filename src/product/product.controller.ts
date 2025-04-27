import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create_product.dto';
import { UpdateProductDto } from './dto/update_product.dto';
import { CreateProductVariantDto } from './dto/create_product_variant';
import { ProductVariantService } from './product_variant.service';
import { UpdateProductVariantDto } from './dto/update_product_variant.dto';
import { ProductImageService } from './product_image.service';
import { UpdateProductImageDto } from './dto/update_product_image.dto';
import { CreateProductImageDto } from './dto/create_product_image.dto';

@Controller('product')
export class ProductController {
  constructor(
    private productService: ProductService,
    private productVariantService: ProductVariantService,
    private productImageService: ProductImageService,
  ) {}

  @Get()
  async findAllProduct() {
    return this.productService.findAllProduct();
    // return 'check get';
  }

  @Post()
  async createProduct(@Body() body: CreateProductDto) {
    return this.productService.createProduct(body);
    // return 'hello';
  }

  // Get all product variants
  @Get('variant')
  async showAllProductVariant() {
    return this.productVariantService.showAllProductVariant();
  }

  @Get('image')
  async showAllProductImages() {
    return await this.productImageService.showAllProductImages();
  }

  @Get(':id')
  async findOneProduct(@Param('id') id: number) {
    return this.productService.findOneProduct(id);
  }

  @Put(':id')
  async updateProduct(@Param('id') id: number, @Body() body: UpdateProductDto) {
    return this.productService.updateProduct(id, body);
  }

  @Delete(':id')
  async removeProduct(@Param('id') id: number) {
    return this.productService.removeProduct(id);
  }

  // Get a specific product variant by ID
  @Get('variant/:id')
  async findOneProductVariant(@Param('id') id: number) {
    return await this.productVariantService.findOneProductVariant(id);
  }

  // Endpoint to create a product variant
  @Post('variant')
  async createProductVariant(@Body() body: CreateProductVariantDto) {
    return await this.productVariantService.createProductVariant(body);
    // return 'this is variant route';
  }

  // Update a product variant
  @Put('variant/:id')
  async updateProductVariant(
    @Param('id') id: number,
    @Body() body: UpdateProductVariantDto,
  ) {
    return await this.productVariantService.updateProductVariant(id, body);
  }

  // Create a new product image
  @Post('image')
  async createProductImage(@Body() body: CreateProductImageDto) {
    return await this.productImageService.createProductImage(body);
  }

  // Get a single product image by ID
  @Get('image/:id')
  async findOneProductImage(@Param('id') id: number) {
    return await this.productImageService.findOneProductImage(id);
  }

  // Update a product image
  @Put('image/:id')
  async updateProductImage(
    @Param('id') id: number,
    @Body() body: UpdateProductImageDto,
  ) {
    return await this.productImageService.updateProductImage(id, body);
  }

  // Delete a product image
  @Delete('image/:id')
  async removeProductImage(@Param('id') id: number) {
    return await this.productImageService.removeProductImage(id);
  }
}
