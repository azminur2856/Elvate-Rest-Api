import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from 'src/user/user.module';
import { RefreshToken } from './entities/refresh_token.entity';
import { BlacklistToken } from './entities/blackList_token.entity';
import { JwtWithBlacklistGuard } from './CustomGuard/jwt_blacklist.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken, BlacklistToken]),
    PassportModule,
    UserModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtWithBlacklistGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtWithBlacklistGuard],
})
export class AuthModule {}
