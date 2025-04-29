import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './entities/users.entity';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityLog } from 'src/activity-logs/entities/activity-logs.entity';
import { MailService } from 'src/auth/services/mail.services';

@Module({
  imports: [TypeOrmModule.forFeature([Users, ActivityLog])],
  controllers: [UsersController],
  providers: [UsersService, MailService, ActivityLogsService],
})
export class UsersModule {}
