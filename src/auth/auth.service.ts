import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';
import { AuthJwtPayload } from './types/auth-jwtPayload';
import refreshJwtConfig from './config/refresh-jwt.config';
import { ConfigType } from '@nestjs/config';
import * as argon2 from 'argon2';
import { ActivityType } from 'src/activity-logs/enums/activity-type.enum';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { CurrentUser } from './types/current-user';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { SmsService } from './services/sms.service';
import { MailService } from './services/mail.services';
import { InjectRepository } from '@nestjs/typeorm';
import { Verification } from './entities/verification.entity';
import { Repository } from 'typeorm';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerificationMethod } from './enums/verification-method.enum';
import { nanoid } from 'nanoid';
import { VerificationType } from './enums/verification-type.enum';
import { maskEmail } from './utility/email-mask.util';
import { generateOtp } from './utility/otp.util';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private activityLogsService: ActivityLogsService,
    private usersService: UsersService,
    private smsService: SmsService,
    private mailService: MailService,
    private jwtService: JwtService,
    @Inject(refreshJwtConfig.KEY)
    private refreshTokenConfig: ConfigType<typeof refreshJwtConfig>,
    @InjectRepository(Verification)
    private verificationRepository: Repository<Verification>,
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

  //ChangePassword
  async changePassword(id: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.usersService.getUserByIdWithCredential(id);
    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    if (!(await compare(changePasswordDto.oldPassword, user.password))) {
      throw new UnauthorizedException('Old password does not match');
    }

    if (changePasswordDto.oldPassword === changePasswordDto.newPassword) {
      throw new BadRequestException(
        'New password cannot be same as old password',
      );
    }

    const hashedPassword = bcrypt.hashSync(changePasswordDto.newPassword, 10);
    const result = this.usersService.changePassword(id, hashedPassword);

    // Update Action Log
    const activityLog = {
      activity: ActivityType.USER_CHANGE_PASSWORD,
      description: 'User Changed Password',
      user: user,
    };
    await this.activityLogsService.createActivityLog(activityLog);

    return {
      message: 'Password changed successfully',
      generatedMaps: (await result).generatedMaps,
      raw: (await result).raw,
      affected: (await result).affected,
    };
  }

  //Forgot password
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.usersService.getUserByDynamicCredential(
      forgotPasswordDto.email,
    );
    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    if (forgotPasswordDto.verificationMethod === VerificationMethod.EMAIL) {
      const resetToken = nanoid(64);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Expires in 1 hour

      await this.verificationRepository.delete({
        type: VerificationType.PASSWORD_RESET_TOKEN,
        userId: user.id,
      });

      const verificationData = this.verificationRepository.create({
        type: VerificationType.PASSWORD_RESET_TOKEN,
        tokenOrOtp: resetToken,
        user: user,
        expiresAt: expiresAt,
      });
      await this.verificationRepository.save(verificationData);

      const fullName = user.firstName + ' ' + user.lastName;

      const response = await this.mailService.sendPasswordResetEmail(
        user.email,
        fullName,
        resetToken,
      );

      const maskedEmail = maskEmail(user.email);
      if (response.accepted.length > 0 && response.rejected.length === 0) {
        return {
          message: `Password reset link sent to your email ${maskedEmail}`,
          resetToken: resetToken,
        };
      } else {
        return {
          message: `Failed to sent email to your email ${maskedEmail}`,
        };
      }
    } else if (
      forgotPasswordDto.verificationMethod === VerificationMethod.SMS
    ) {
      const otp = generateOtp();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 2); // Expires in 2 minutes

      await this.verificationRepository.delete({
        type: VerificationType.PASSWORD_RESET_OTP,
        userId: user.id,
      });

      const verificationData = this.verificationRepository.create({
        type: VerificationType.PASSWORD_RESET_OTP,
        tokenOrOtp: otp,
        user: user,
        expiresAt: expiresAt,
      });
      await this.verificationRepository.save(verificationData);

      if (!user.phone) {
        throw new BadRequestException('Phone number not found');
      }
      const fullName = user.firstName + ' ' + user.lastName;
      const response = await this.smsService.sendOtp(user.phone, fullName, otp); // Send OTP to user phone

      const maskedPhone = `********${user.phone.slice(-2)}`;

      if (response.success) {
        return {
          message: `OTP Successfully sent to your phone number ${maskedPhone}`,
        };
      } else {
        return {
          message: `Failed to send OTP to your phone number ${maskedPhone}`,
        };
      }
    } else {
      throw new BadRequestException('Invalid verification method');
    }
  }

  //Reset Password
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    if (resetPasswordDto.verificationMethod === VerificationMethod.EMAIL) {
      const verificationObj = await this.verificationRepository.findOne({
        where: {
          tokenOrOtp: resetPasswordDto.resetTokenOrOTP,
          type: VerificationType.PASSWORD_RESET_TOKEN,
        },
        relations: ['user'], // It will include user object in the response. Access by verificationObj.user
      });

      if (!verificationObj) {
        throw new UnauthorizedException('Password Reset Link Expired');
      }

      const user = verificationObj.user;
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (verificationObj.expiresAt < new Date()) {
        throw new BadRequestException('Password reset Link expired');
      }

      const hashedPassword = bcrypt.hashSync(resetPasswordDto.newPassword, 10);
      await this.usersService.changePassword(user.id, hashedPassword);

      await this.verificationRepository.delete(verificationObj.id);

      const activityLog = {
        activity: ActivityType.USER_CHANGE_PASSWORD,
        description: 'User Reset Password With EMAIL Verification',
        user: user,
      };
      await this.activityLogsService.createActivityLog(activityLog);

      return { message: 'Password reset successful' };
    } else if (resetPasswordDto.verificationMethod === VerificationMethod.SMS) {
      const verificationObj = await this.verificationRepository.findOne({
        where: {
          tokenOrOtp: resetPasswordDto.resetTokenOrOTP,
          type: VerificationType.PASSWORD_RESET_OTP,
        },
        relations: ['user'], // It will include user object in the response. Access by verificationObj.user
      });

      if (!verificationObj) {
        throw new UnauthorizedException('Invalid or Expired OTP');
      }

      const user = verificationObj.user;
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (verificationObj.expiresAt < new Date()) {
        throw new BadRequestException('OTP expired');
      }

      const hashedPassword = bcrypt.hashSync(resetPasswordDto.newPassword, 10);
      await this.usersService.changePassword(user.id, hashedPassword);

      await this.verificationRepository.delete(verificationObj.id);

      const activityLog = {
        activity: ActivityType.USER_CHANGE_PASSWORD,
        description: 'User Reset Password With SMS Verification',
        user: user,
      };
      await this.activityLogsService.createActivityLog(activityLog);

      return { message: 'Password reset successful' };
    } else {
      throw new BadRequestException('Invalid verification method');
    }
  }
}
