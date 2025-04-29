import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { LocalStrategy } from './strategies/local.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from 'src/users/entities/users.entity';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityLog } from 'src/activity-logs/entities/activity-logs.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Users, ActivityLog])],
  controllers: [AuthController],
  providers: [AuthService, UsersService, ActivityLogsService, LocalStrategy],
})
export class AuthModule {}
