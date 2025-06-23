import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import stripeConfig from './config/stripe.config';
import { Subscription } from './entities/subscription.entity';
import { Payment } from './entities/payment.entity';
import { UsersModule } from 'src/users/users.module';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityLog } from 'src/activity-logs/entities/activity-logs.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Payment, ActivityLog]),
    UsersModule,
    ConfigModule.forFeature(stripeConfig),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, ActivityLogsService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
