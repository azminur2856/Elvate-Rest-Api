import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product_variant.entity';
import { ProductImage } from './entities/product_image.entity';
import { ProductVariantService } from './product_variant.service';
import { ProductImageService } from './product_image.service';
import { ProductLog } from '../log/entities/product_logs.entity';
import { LogModule } from 'src/log/log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductLog,
      ProductImage,
      ProductVariant,
    ]),
    LogModule,
  ],
  controllers: [ProductController],
  providers: [ProductService, ProductVariantService, ProductImageService],
  exports: [TypeOrmModule.forFeature([ProductVariant])],
})
export class ProductModule {}
