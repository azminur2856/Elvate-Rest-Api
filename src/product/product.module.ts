import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product_variant.entity';
import { ProductImage } from './entities/product_image.entity';
import { ProductVariantService } from './product_variant.service';
import { ProductImageService } from './product_image.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductImage, ProductVariant])],
  controllers: [ProductController],
  providers: [ProductService, ProductVariantService, ProductImageService],
})
export class ProductModule {}
