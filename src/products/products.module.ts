import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { CatalogService } from './catalog.service';
import { ProductsController } from './products.controller';
import { CategoriesModule } from 'src/categories/categories.module';
import { PricingModule } from 'src/pricing/pricing.module';
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductImage, ProductVariant]),
    CategoriesModule,
    PricingModule,
    ActivityLogsModule,
  ],
  controllers: [ProductsController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class ProductsModule {}
