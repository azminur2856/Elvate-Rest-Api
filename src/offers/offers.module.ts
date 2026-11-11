import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from './entities/coupon.entity';
import { CouponUsage } from './entities/coupon-usage.entity';
import { FlashSale } from './entities/flash-sale.entity';
import { CouponService } from './coupon.service';

/** Coupons + flash sales. Admin CRUD and GET /offers arrive with BE-18. */
@Module({
  imports: [TypeOrmModule.forFeature([Coupon, CouponUsage, FlashSale])],
  providers: [CouponService],
  exports: [CouponService],
})
export class OffersModule {}
