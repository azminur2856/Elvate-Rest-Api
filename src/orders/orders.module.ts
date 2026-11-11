import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { OrderMailer } from './order-mailer';
import { CartModule } from 'src/cart/cart.module';
import { AddressesModule } from 'src/addresses/addresses.module';
import { OffersModule } from 'src/offers/offers.module';
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';
import { ReviewsModule } from 'src/reviews/reviews.module';
import { MailService } from 'src/auth/services/mail.services';
import stripeConfig from 'src/subscription/config/stripe.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderStatusHistory]),
    ConfigModule.forFeature(stripeConfig),
    CartModule,
    AddressesModule,
    OffersModule,
    ActivityLogsModule,
    ReviewsModule,
  ],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, AdminOrdersService, OrderMailer, MailService],
  exports: [OrdersService],
})
export class OrdersModule {}
