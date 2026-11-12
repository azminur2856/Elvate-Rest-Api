import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from './entities/coupon.entity';
import { CouponUsage } from './entities/coupon-usage.entity';
import { FlashSale } from './entities/flash-sale.entity';
import { Product } from 'src/products/entities/product.entity';
import { CouponService } from './coupon.service';
import { OffersService } from './offers.service';
import {
  AdminCouponsController,
  AdminFlashSalesController,
  OffersController,
} from './offers.controller';
import { ProductsModule } from 'src/products/products.module';
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';

/** Coupons + flash sales (BE-18). CouponService is also used by orders. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Coupon, CouponUsage, FlashSale, Product]),
    ProductsModule,
    ActivityLogsModule,
  ],
  controllers: [
    OffersController,
    AdminCouponsController,
    AdminFlashSalesController,
  ],
  providers: [CouponService, OffersService],
  exports: [CouponService],
})
export class OffersModule {}
