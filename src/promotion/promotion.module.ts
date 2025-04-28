import { Module } from '@nestjs/common';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './services/promotion.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from './entities/coupon.entity';
import { PromoCodeUsage } from './entities/promocode_usage.entity';
import { FlashSale } from './entities/flash_sale.entity';
import { UserRewards } from './entities/user_rewards.entity';
import { CouponController } from './controllers/coupon.controller';
import { FlashSaleController } from './controllers/flash_sale.controller';
import { PromoCodeUsageController } from './controllers/promo_code_usage.controller';
import { UserRewardsController } from './controllers/user_rewards.controller';
import { CouponService } from './services/coupon.service';
import { FlashSaleService } from './services/flashSale.service';
import { PromoCodeUsageService } from './services/promoCodeUsage.service';
import { UserRewardsService } from './services/userRewards.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Coupon, PromoCodeUsage, FlashSale, UserRewards]),
  ],
  controllers: [
    PromotionController,
    CouponController,
    FlashSaleController,
    PromoCodeUsageController,
    UserRewardsController,
  ],
  providers: [
    PromotionService,
    CouponService,
    FlashSaleService,
    PromoCodeUsageService,
    UserRewardsService,
  ],
})
export class PromotionModule {}
