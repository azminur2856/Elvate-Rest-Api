import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { UserCart } from './entities/user_cart.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductModule } from 'src/product/product.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserCart]), ProductModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
