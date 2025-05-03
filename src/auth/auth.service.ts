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
import { generateVerificationToken } from './utility/token.util';
import { VerifyPhoneDto } from './dto/verify-Phone.dto';

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

  // Verify Registration after user sign up
  async verifyRegistratioin(token: string) {
    const verification = await this.verificationRepository.findOne({
      where: {
        tokenOrOtp: token,
        type: VerificationType.USER_REGISTRATION_VERIFICATION,
      },
      relations: ['user'],
    });

    if (!verification) {
      throw new NotFoundException('Invalid or expired token');
    }

    if (verification.isUsed || new Date() > verification.expiresAt) {
      throw new BadRequestException('Token has already been used or expired');
    }

    verification.isUsed = true;
    await this.verificationRepository.save(verification);

    return await this.usersService.verifyRegistrationUpdate(
      verification.user.id,
    );
  }

  // Validate user credentials
  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const isPasswordMatch = await compare(password, user.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid password');
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Email not verified. Please check your inbox and verify your email address to proceed.',
      );
    }
    if (!user.isActive) {
      throw new UnauthorizedException(
        'User account is inactive or has been blocked. Please contact support for assistance.',
      );
    }
    return { id: user.id };
  }

  // Lofin user and generate access and refresh tokens
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

  // Generate access and refresh tokens
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

  // Generate new access token using the refresh token
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

  // Validate refresh token
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

  // Logout user and remove refresh token from the database
  async logout(userId: string) {
    const activityLog = {
      activity: ActivityType.USER_LOGOUT,
      description: `User logged out with id ${userId}`,
      user: await this.usersService.getUserById(userId),
    };
    await this.activityLogsService.createActivityLog(activityLog);

    await this.usersService.updateHashedRefreshToken(userId, '');

    await this.usersService.setLastLogoutTime(userId);

    return {
      message: 'User logged out successfully',
    };
  }

  async validateJwtUser(userId: string, tokenIssuedAt: number) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');

    if (
      user.lastLogoutAt &&
      user.lastLogoutAt > new Date(tokenIssuedAt * 1000)
    ) {
      throw new UnauthorizedException('Token invalid due to logout');
    }

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
    const user = await this.usersService.findOne(id);
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
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);
    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    const fullName = user.firstName + ' ' + (user.lastName || '');

    if (forgotPasswordDto.verificationMethod === VerificationMethod.EMAIL) {
      if (!user.isEmailVerified) {
        throw new BadRequestException(
          'Email is not verified. Please verify your email address to proceed with password reset.',
        );
      }
      const resetToken = generateVerificationToken();
      const expiresAt = new Date();
      //expiresAt.setHours(expiresAt.getHours() + 1); // Expires in 1 hour
      expiresAt.setMinutes(expiresAt.getMinutes() + 5); // Expires in 5 minutes

      await this.verificationRepository.update(
        {
          userId: user.id,
          type: VerificationType.PASSWORD_RESET_TOKEN,
          isUsed: false,
        },
        { isUsed: true },
      );

      const verificationData = this.verificationRepository.create({
        type: VerificationType.PASSWORD_RESET_TOKEN,
        tokenOrOtp: resetToken,
        user: user,
        expiresAt: expiresAt,
      });

      await this.verificationRepository.save(verificationData);

      const response = await this.mailService.sendPasswordResetEmail(
        user.email,
        fullName,
        resetToken,
      );

      const activityLog = {
        activity: ActivityType.REQUEST_TOKEN,
        description: 'User requested Token for reset password',
        user: user,
      };

      await this.activityLogsService.createActivityLog(activityLog);

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
      if (!user.phone) {
        throw new BadRequestException(
          'Phone number not found. Please add a valid phone number to proceed with password reset.',
        );
      }
      if (!user.isPhoneVerified) {
        throw new BadRequestException(
          'Phone number is not verified. Please verify your phone number to proceed with password reset.',
        );
      }
      const otp = generateOtp();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 2); // Expires in 2 minutes

      await this.verificationRepository.update(
        {
          userId: user.id,
          type: VerificationType.PASSWORD_RESET_OTP,
          isUsed: false,
        },
        { isUsed: true },
      );

      const verificationData = this.verificationRepository.create({
        type: VerificationType.PASSWORD_RESET_OTP,
        tokenOrOtp: otp,
        user: user,
        expiresAt: expiresAt,
      });

      await this.verificationRepository.save(verificationData);

      const response = await this.smsService.sendOtp(user.phone, fullName, otp); // Send OTP to user phone

      const activityLog = {
        activity: ActivityType.REQUEST_OTP,
        description: 'User requested OTP for reset password',
        user: user,
      };

      await this.activityLogsService.createActivityLog(activityLog);

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
    let verification: Verification | null = null;

    if (resetPasswordDto.verificationMethod === VerificationMethod.EMAIL) {
      verification = await this.verificationRepository.findOne({
        where: {
          tokenOrOtp: resetPasswordDto.resetTokenOrOTP,
          type: VerificationType.PASSWORD_RESET_TOKEN,
        },
        relations: ['user'],
      });

      if (!verification) {
        throw new NotFoundException('Password reset link not found');
      }

      if (verification.isUsed) {
        throw new BadRequestException(
          'This password reset link has already been used',
        );
      }

      if (verification.expiresAt < new Date()) {
        throw new BadRequestException('This password reset link has expired');
      }
    } else if (resetPasswordDto.verificationMethod === VerificationMethod.SMS) {
      verification = await this.verificationRepository.findOne({
        where: {
          tokenOrOtp: resetPasswordDto.resetTokenOrOTP,
          type: VerificationType.PASSWORD_RESET_OTP,
        },
        relations: ['user'],
      });

      if (!verification) {
        throw new NotFoundException('OTP not found');
      }

      if (verification.isUsed) {
        throw new BadRequestException('This OTP has already been used');
      }

      if (verification.expiresAt < new Date()) {
        throw new BadRequestException('This OTP has expired');
      }
    } else {
      throw new BadRequestException('Invalid verification method');
    }

    const user = verification.user;

    if (!user) {
      throw new NotFoundException('User not found for this token/OTP');
    }

    const hashedPassword = bcrypt.hashSync(resetPasswordDto.newPassword, 10);
    await this.usersService.changePassword(user.id, hashedPassword);

    verification.isUsed = true;
    await this.verificationRepository.save(verification);

    const activityLog = {
      activity: ActivityType.USER_CHANGE_PASSWORD,
      description:
        resetPasswordDto.verificationMethod === VerificationMethod.EMAIL
          ? 'User reset password via EMAIL Verification'
          : 'User reset password via SMS Verification',
      user: user,
    };

    await this.activityLogsService.createActivityLog(activityLog);

    return { message: 'Password reset successful' };
  }

  //Check if phone number is already verified
  async phoneVerification(userId: string) {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phone) {
      throw new BadRequestException(
        'Phone number not found. Please add a valid phone number for verification.',
      );
    }

    if (user.isPhoneVerified) {
      throw new BadRequestException('Phone number already verified');
    }

    const otp = generateOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 2); // Expires in 2 minutes

    await this.verificationRepository.update(
      {
        userId: user.id,
        type: VerificationType.PHONE_VERIFICATION,
        isUsed: false,
      },
      { isUsed: true },
    );

    const verificationData = this.verificationRepository.create({
      type: VerificationType.PHONE_VERIFICATION,
      tokenOrOtp: otp,
      user: user,
      expiresAt: expiresAt,
    });

    await this.verificationRepository.save(verificationData);

    const response = await this.smsService.sendOtpPhoneVerification(
      user.phone,
      user.firstName,
      otp,
    );

    const activityLog = {
      activity: ActivityType.REQUEST_OTP,
      description: 'User requested OTP for phone verification',
      user: user,
    };

    await this.activityLogsService.createActivityLog(activityLog);

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
  }

  // Verify Phone Number
  async verifyPhone(verifyPhoneDto: VerifyPhoneDto) {
    const verification = await this.verificationRepository.findOne({
      where: {
        tokenOrOtp: verifyPhoneDto.otp,
        type: VerificationType.PHONE_VERIFICATION,
      },
      relations: ['user'],
    });

    if (!verification) {
      throw new NotFoundException('OTP not found');
    }

    if (verification.isUsed) {
      throw new BadRequestException('OTP has already been used');
    }

    if (new Date() > verification.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    verification.isUsed = true;
    await this.verificationRepository.save(verification);

    await this.usersService.verifyPhoneNumber(verification.user.id);

    const activityLog = {
      activity: ActivityType.USER_VERIFY_PHONE,
      description: 'User verified phone number',
      user: verification.user,
    };

    await this.activityLogsService.createActivityLog(activityLog);

    return { message: 'Phone number verified successfully' };
  }
}
