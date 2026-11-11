import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartItem } from './entities/cart-item.entity';
import { ProductVariant } from 'src/products/entities/product-variant.entity';
import { ProductImage } from 'src/products/entities/product-image.entity';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { PricingModule } from 'src/pricing/pricing.module';
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CartItem, ProductVariant, ProductImage]),
    PricingModule,
    ActivityLogsModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
