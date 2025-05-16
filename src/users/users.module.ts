import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './entities/users.entity';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityLog } from 'src/activity-logs/entities/activity-logs.entity';
import { MailService } from 'src/auth/services/mail.services';
import { Verification } from 'src/auth/entities/verification.entity';
import { FaceVerificationService } from './services/face-verification.service';

@Module({
  imports: [TypeOrmModule.forFeature([Users, ActivityLog, Verification])],
  controllers: [UsersController],
  providers: [
    UsersService,
    MailService,
    ActivityLogsService,
    FaceVerificationService,
  ],
})
export class UsersModule {}
