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

  // @UseGuards(AuthGuard('jwt'))
  // @Post()
  // async createProduct(@Request() req, @Body() body: CreateProductDto) {
  //   if (req.user.role !== 'admin') {
  //     throw new Error('Only admin can create products');
  //   }

  //   // const adminId = req.user.id; // 👈 get admin id from the JWT
  //   const adminId = Number(req.user.id);

  //   return this.productService.createProduct({
  //     ...body,
  //     created_by: adminId, // 👈 inject admin id into product creation
  //   });
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

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async updateProduct(
    @Request() req,
    @Param('id') id: number,
    @Body() body: UpdateProductDto,
  ) {
    if (req.user.role !== 'admin') {
      throw new Error('Only admin can update products');
    }
    return this.productService.updateProduct(id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async removeProduct(@Request() req, @Param('id') id: number) {
    if (req.user.role !== 'admin') {
      throw new Error('Only admin can delete products');
    }
    return this.productService.removeProduct(id);
  }

  @Get('variant/:id')
  async findOneProductVariant(@Param('id') id: number) {
    return await this.productVariantService.findOneProductVariant(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('variant')
  async createProductVariant(
    @Request() req,
    @Body() body: CreateProductVariantDto,
  ) {
    if (req.user.role !== 'admin') {
      throw new Error('Only admin can create product variants');
    }
    return await this.productVariantService.createProductVariant(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('variant/:id')
  async updateProductVariant(
    @Request() req,
    @Param('id') id: number,
    @Body() body: UpdateProductVariantDto,
  ) {
    if (req.user.role !== 'admin') {
      throw new Error('Only admin can update product variants');
    }
    return await this.productVariantService.updateProductVariant(id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('image')
  async createProductImage(
    @Request() req,
    @Body() body: CreateProductImageDto,
  ) {
    if (req.user.role !== 'admin') {
      throw new Error('Only admin can upload product images');
    }
    return await this.productImageService.createProductImage(body);
  }

  @Get('image/:id')
  async findOneProductImage(@Param('id') id: number) {
    return await this.productImageService.findOneProductImage(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('image/:id')
  async updateProductImage(
    @Request() req,
    @Param('id') id: number,
    @Body() body: UpdateProductImageDto,
  ) {
    if (req.user.role !== 'admin') {
      throw new Error('Only admin can update product images');
    }
    return await this.productImageService.updateProductImage(id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('image/:id')
  async removeProductImage(@Request() req, @Param('id') id: number) {
    if (req.user.role !== 'admin') {
      throw new Error('Only admin can delete product images');
    }
    return await this.productImageService.removeProductImage(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('variant/:id')
  async removeProductVariant(@Request() req, @Param('id') id: number) {
    if (req.user.role !== 'admin') {
      throw new Error('Only admin can delete product images');
    }
    return await this.productVariantService.removeProductVariant(id);
  }
}
