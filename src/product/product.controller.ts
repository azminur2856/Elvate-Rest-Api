import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Request,
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
import { AuthGuard } from '@nestjs/passport';

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

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createProduct(@Request() req, @Body() body: CreateProductDto) {
    if (req.user.role !== 'admin') {
      throw new Error('Only admin can create products');
    }
    return this.productService.createProduct(body);
  }

  // async createProduct(@Body() body: CreateProductDto) {
  //   return this.productService.createProduct(body);
  //   // return 'hello';
  // }

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

  @Get('variant/:id')
  async findOneProductVariant(@Param('id') id: number) {
    return await this.productVariantService.findOneProductVariant(id);
  }

  @Post('variant')
  async createProductVariant(@Body() body: CreateProductVariantDto) {
    return await this.productVariantService.createProductVariant(body);
  }

  @Put('variant/:id')
  async updateProductVariant(
    @Param('id') id: number,
    @Body() body: UpdateProductVariantDto,
  ) {
    return await this.productVariantService.updateProductVariant(id, body);
  }

  @Post('image')
  async createProductImage(@Body() body: CreateProductImageDto) {
    return await this.productImageService.createProductImage(body);
  }

  @Get('image/:id')
  async findOneProductImage(@Param('id') id: number) {
    return await this.productImageService.findOneProductImage(id);
  }

  @Put('image/:id')
  async updateProductImage(
    @Param('id') id: number,
    @Body() body: UpdateProductImageDto,
  ) {
    return await this.productImageService.updateProductImage(id, body);
  }

  @Delete('image/:id')
  async removeProductImage(@Param('id') id: number) {
    return await this.productImageService.removeProductImage(id);
  }
}
