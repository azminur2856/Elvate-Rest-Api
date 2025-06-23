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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [dbConfig],
    }),
    TypeOrmModule.forRootAsync({ useFactory: dbConfig }),
    UsersModule,
    AuthModule,
    ActivityLogsModule,
    ReviewsModule,
    OcrModule,
    SubscriptionModule,
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
