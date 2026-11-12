import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashSale } from 'src/offers/entities/flash-sale.entity';
import { PricingService } from './pricing.service';

@Module({
  imports: [TypeOrmModule.forFeature([FlashSale])],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
