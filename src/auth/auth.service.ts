import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { UsersService } from 'src/users/users.service';
import { AuthJwtPayload } from './types/auth-jwtPayload';
import refreshJwtConfig from './config/refresh-jwt.config';
import { ConfigType } from '@nestjs/config';
import * as argon2 from 'argon2';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { CurrentUser } from './types/current-user';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(refreshJwtConfig.KEY)
    private refreshTokenConfig: ConfigType<typeof refreshJwtConfig>,
    private activityLogsService: ActivityLogsService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const isPasswordMatch = await compare(password, user.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid password');
    }
    return { id: user.id };
  }

  async login(userId: string) {
    const { accessToken, refreshToken } = await this.generateToken(userId);

    const hashedRefreshToken = await argon2.hash(refreshToken);
    await this.usersService.updateHashedRefreshToken(
      userId,
      hashedRefreshToken,
    );

    this.usersService.updateLastLogin(userId);

    const activityLog = {
      activity: ActivityType.USER_LOGIN,
      description: `User logged in with id ${userId}`,
      user: await this.usersService.getUserById(userId),
    };
    await this.activityLogsService.createActivityLog(activityLog);

    return {
      id: userId,
      accessToken,
      refreshToken,
    };
  }

  async generateToken(userId: string) {
    const payload: AuthJwtPayload = { sub: userId };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, this.refreshTokenConfig),
    ]);
    return {
      accessToken,
      refreshToken,
    };
  }

  refreshToken(userId: string) {
    const payload: AuthJwtPayload = { sub: userId };
    const accessToken = this.jwtService.sign(payload);
    return {
      id: userId,
      accessToken,
    };
  }

  //Generate new access and refresh tokens using the refresh token
  // async refreshToken(userId: string) {
  //   const { accessToken, refreshToken } = await this.generateToken(userId);
  //   const hashedRefreshToken = await argon2.hash(refreshToken);
  //   await this.usersService.updateHashedRefreshToken(
  //     userId,
  //     hashedRefreshToken,
  //   );
  //   return {
  //     id: userId,
  //     accessToken,
  //     refreshToken,
  //   };
  // }

  async validateRefreshToken(userId: string, refreshToken: string) {
    const user = await this.usersService.getUserRefreshTokenFromDB(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.refreshToken) {
      throw new UnauthorizedException('No refresh token found for user');
    }
    const refreshTokenMatches = await argon2.verify(
      user.refreshToken,
      refreshToken,
    );
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { id: userId };
  }

  async logout(userId: string) {
    const activityLog = {
      activity: ActivityType.USER_LOGOUT,
      description: `User logged out with id ${userId}`,
      user: await this.usersService.getUserById(userId),
    };
    await this.activityLogsService.createActivityLog(activityLog);

    const refreshToken = '';
    await this.usersService.updateHashedRefreshToken(userId, refreshToken);
    return {
      message: 'User logged out successfully',
    };
  }

  async validateJwtUser(userId: string) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const currentUser: CurrentUser = { id: user.id, role: user.role };
    return currentUser;
  }

  async validateGoogleUser(googleUser: CreateUserDto) {
    const user = await this.usersService.findByEmail(googleUser.email);
    if (user) return user;
    this.usersService.createUser(googleUser);
  }
}
