import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { LocalStrategy } from './strategies/local.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from 'src/users/entities/users.entity';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityLog } from 'src/activity-logs/entities/activity-logs.entity';
import { JwtModule } from '@nestjs/jwt';
import jwtConfig from './config/jwt.config';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import refreshJwtConfig from './config/refresh-jwt.config';
import { RefreshJwtStrategy } from './strategies/refresh.strategy';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from './guards/roles/roles.guard';
import googleOauthConfig from './config/google-oauth.config';
import { GoogleStrategy } from './strategies/google.strategy';
import { MailService } from './services/mail.services';
import { SmsService } from './services/sms.service';
import emailConfig from './config/email.config';
import { Verification } from './entities/verification.entity';
import { FaceVerificationService } from 'src/users/services/face-verification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users, ActivityLog, Verification]),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ConfigModule.forFeature(jwtConfig),
    ConfigModule.forFeature(refreshJwtConfig),
    ConfigModule.forFeature(googleOauthConfig),
    ConfigModule.forFeature(emailConfig),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersService,
    ActivityLogsService,
    LocalStrategy,
    JwtStrategy,
    RefreshJwtStrategy,
    GoogleStrategy,
    MailService,
    SmsService,
    FaceVerificationService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, //@UseGards(JwtAuthGuard) Global guard for JWT authentication for all API endpoints
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, //@UseGards(RolesGuard) Global guard for role-based access control for all API endpoints
    },
  ],
})
export class AuthModule {}
