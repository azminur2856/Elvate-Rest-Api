import { Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { ActivityLog } from 'src/activity-logs/entities/activity-logs.entity';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, ActivityLog]),
    SubscriptionModule,
    UsersModule,
  ],
  controllers: [OcrController],
  providers: [OcrService, ActivityLogsService],
})
export class OcrModule {}
