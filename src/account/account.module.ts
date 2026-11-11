import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from 'src/users/entities/users.entity';
import { UserSession } from 'src/auth/entities/user-session.entity';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';
import stripeConfig from 'src/subscription/config/stripe.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users, UserSession]),
    ConfigModule.forFeature(stripeConfig),
    ActivityLogsModule,
  ],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
