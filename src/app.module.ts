import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import dbConfig from './config/db.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { ReviewsModule } from './reviews/reviews.module';
import { OcrModule } from './ocr/ocr.module';
import { DecryptSessionMiddleware } from './auth/middleware/decrypt-session.middleware';
import { SubscriptionModule } from './subscription/subscription.module';
import { HealthModule } from './health/health.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { AddressesModule } from './addresses/addresses.module';
import { OffersModule } from './offers/offers.module';
import { OrdersModule } from './orders/orders.module';
import { DeliveryModule } from './delivery/delivery.module';
import { AccountModule } from './account/account.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { throttlerTracker } from './auth/throttle/rate-limit';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [dbConfig],
    }),
    TypeOrmModule.forRootAsync({ useFactory: dbConfig }),
    // Not a global guard: only the routes marked @RateLimit are throttled.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 10 }],
      errorMessage: 'Too many attempts. Please wait a moment and try again.',
      getTracker: (req) => throttlerTracker(req),
    }),
    UsersModule,
    AuthModule,
    ActivityLogsModule,
    ReviewsModule,
    OcrModule,
    SubscriptionModule,
    HealthModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    AddressesModule,
    OffersModule,
    OrdersModule,
    DeliveryModule,
    AccountModule,
    WishlistModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
//export class AppModule {}
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DecryptSessionMiddleware).forRoutes('*'); // Or restrict as needed
  }
}
