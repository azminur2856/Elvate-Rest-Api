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
import { SmsService } from './services/sms.service';
import { MailService } from './services/mail.services';
import { InjectRepository } from '@nestjs/typeorm';
import { Verification } from './entities/verification.entity';
import { UserSession } from './entities/user-session.entity';
import { LessThan, Repository } from 'typeorm';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerificationMethod } from './enums/verification-method.enum';
import { VerificationType } from './enums/verification-type.enum';
import { maskEmail } from './utility/email-mask.util';
import { generateOtp } from './utility/otp.util';
import { useSmsCode } from './utility/sms-code';
import { SettingsService } from 'src/settings/settings.service';
import {
  LoginAttemptsService,
  emailKey,
} from './attempts/login-attempts.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { generateVerificationToken } from './utility/token.util';
import { VerifyPhoneDto } from './dto/verify-Phone.dto';
import { CreateGoogleUserDto } from 'src/users/dto/create-google-user.dto';
import {
  SESSION_COOKIE,
  clearSessionCookieOptions,
} from './utility/session-cookie.options';

/** SEC-12: one answer for "no such account" and "wrong password". */
export const INVALID_LOGIN = 'Invalid email or password';
/** bcrypt hash of a random string: makes unknown-e-mail logins as slow as real ones. */
const DUMMY_BCRYPT_HASH =
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.1lbfHNiBo2YX0yz4d0SmKTAtvLlW';

/** Same text as the password-login check for a blocked account. */
const ACCOUNT_BLOCKED =
  'User account is inactive or has been blocked. Please contact support for assistance.';

/** Hard cap on a login session; matches the session cookie's maxAge (7 days). */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

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
    @InjectRepository(UserSession)
    private sessionRepository: Repository<UserSession>,
    private loginAttempts: LoginAttemptsService,
    private settings: SettingsService,
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
    // SEC-06: per-account limit, so rotating IPs does not help a guesser
    const keys = [emailKey('password-email', email)];
    await this.loginAttempts.assertNotLocked(keys);
    const user = await this.usersService.findByEmail(email);
    // SEC-12: unknown e-mail and wrong password look the same, in the text
    // and in the time taken (a dummy bcrypt check when there is no user)
    const isPasswordMatch = user
      ? await compare(password, user.password)
      : (await compare(password, DUMMY_BCRYPT_HASH)) && false;
    if (!user || !isPasswordMatch) {
      await this.loginAttempts.recordFailure(keys);
      throw new UnauthorizedException(INVALID_LOGIN);
    }
    await this.loginAttempts.clear(keys);
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
  async login(userId: string, loginMethod: string, userAgent?: string) {
    // Opportunistically drop this user's expired sessions.
    await this.sessionRepository.delete({
      userId,
      expiresAt: LessThan(new Date()),
    });

    // One session row per login ("device"). Its id travels inside both JWTs
    // as `sid`, so each device refreshes/logs out independently.
    const now = new Date();
    const session = await this.sessionRepository.save(
      this.sessionRepository.create({
        userId,
        hashedRefreshToken: '',
        loginMethod,
        userAgent: userAgent ? userAgent.slice(0, 512) : null,
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      }),
    );

    const { accessToken, refreshToken } = await this.generateToken(
      userId,
      session.id,
    );
    session.hashedRefreshToken = await argon2.hash(refreshToken);
    await this.sessionRepository.save(session);

    this.usersService.updateLastLogin(userId);

    let activity: ActivityType;
    if (loginMethod === 'googleOAuth') {
      activity = ActivityType.USER_LOGIN_GOOGLEOAUTH;
    } else if (loginMethod === 'faceLogin') {
      activity = ActivityType.USER_LOGIN_FACE;
    } else {
      activity = ActivityType.USER_LOGIN;
    }

    const userData = await this.usersService.getUserById(userId);

    const activityLog = {
      activity,
      description: `User logged in with id ${userId}`,
      user: userData,
    };
    await this.activityLogsService.createActivityLog(activityLog);

    return {
      user: {
        id: userId,
        name: userData.firstName + ' ' + (userData.lastName || ''),
        role: userData.role,
        email: userData.email,
        profileImage: userData.profileImage,
      },
      accessToken,
      refreshToken,
    };
  }

  // Generate access and refresh tokens
  async generateToken(userId: string, sessionId: string) {
    const payload: AuthJwtPayload = { sub: userId, sid: sessionId };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, this.refreshTokenConfig),
    ]);
    return {
      accessToken,
      refreshToken,
    };
  }

  //Generate new access and refresh tokens using the refresh token
  async refreshToken(userId: string, sessionId: string) {
    const { accessToken, refreshToken } = await this.generateToken(
      userId,
      sessionId,
    );
    // Rotate the refresh token for THIS session only.
    await this.sessionRepository.update(
      { id: sessionId, userId },
      {
        hashedRefreshToken: await argon2.hash(refreshToken),
        lastUsedAt: new Date(),
      },
    );

    const userData = await this.usersService.getUserById(userId);

    const activityLog = {
      activity: ActivityType.REFRESH_TOKEN,
      description: `User refresh token's with id ${userId}`,
      user: userData,
    };
    await this.activityLogsService.createActivityLog(activityLog);

    return {
      user: {
        id: userId,
        name: userData.firstName + ' ' + (userData.lastName || ''),
        role: userData.role,
        email: userData.email,
        profileImage: userData.profileImage,
      },
      accessToken,
      refreshToken,
    };
  }

  // Validate refresh token
  async validateRefreshToken(
    userId: string,
    sessionId: string | undefined,
    refreshToken: string,
  ) {
    if (!sessionId) {
      // Token issued before per-device sessions existed.
      throw new UnauthorizedException('Session missing, please log in again');
    }
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new UnauthorizedException(
        'Session not found or already logged out',
      );
    }
    if (session.expiresAt < new Date()) {
      await this.sessionRepository.delete({ id: sessionId });
      throw new UnauthorizedException('Session expired, please log in again');
    }
    // SEC-07: no new tokens for a blocked account; end this session too
    const owner = await this.usersService.findOne(userId);
    if (!owner?.isActive) {
      await this.sessionRepository.delete({ id: sessionId });
      throw new UnauthorizedException(ACCOUNT_BLOCKED);
    }
    const refreshTokenMatches = await argon2.verify(
      session.hashedRefreshToken,
      refreshToken,
    );
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { id: userId, sid: sessionId };
  }

  // Logout THIS device only: delete its session row. Other devices stay logged in.
  async logout(userId: string, sessionId?: string) {
    const activityLog = {
      activity: ActivityType.USER_LOGOUT,
      description: `User logged out with id ${userId}`,
      user: await this.usersService.getUserById(userId),
    };
    await this.activityLogsService.createActivityLog(activityLog);

    if (sessionId) {
      await this.sessionRepository.delete({ id: sessionId, userId });
    }

    return {
      message: 'User logged out successfully',
    };
  }

  // Logout EVERY device (password change / reset): delete all sessions and
  // set lastLogoutAt so any still-valid access token is rejected immediately.
  async logoutAll(userId: string) {
    const activityLog = {
      activity: ActivityType.USER_LOGOUT,
      description: `User logged out from all devices with id ${userId}`,
      user: await this.usersService.getUserById(userId),
    };
    await this.activityLogsService.createActivityLog(activityLog);

    await this.sessionRepository.delete({ userId });
    await this.usersService.setLastLogoutTime(userId);

    return {
      message: 'User logged out from all devices',
    };
  }

  async validateJwtUser(
    userId: string,
    tokenIssuedAt: number,
    sessionId?: string,
  ) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');
    // SEC-07: a blocked account loses access at once, not when tokens expire
    if (!user.isActive) throw new UnauthorizedException(ACCOUNT_BLOCKED);

    if (
      user.lastLogoutAt &&
      user.lastLogoutAt > new Date(tokenIssuedAt * 1000)
    ) {
      throw new UnauthorizedException('Token invalid due to logout');
    }

    // The session row must still exist: deleting it (logout on that device)
    // invalidates its access token immediately instead of after expiry.
    if (!sessionId) {
      throw new UnauthorizedException('Session missing, please log in again');
    }
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
      select: ['id'],
    });
    if (!session) {
      throw new UnauthorizedException('Session ended, please log in again');
    }

    const currentUser: CurrentUser = {
      id: user.id,
      role: user.role,
      sid: sessionId,
    };
    return currentUser;
  }

  async validateGoogleUser(createGoogleUserDto: CreateGoogleUserDto) {
    const user = await this.usersService.findByEmail(createGoogleUserDto.email);
    if (user && user.isActive === false) {
      throw new UnauthorizedException(
        'User is inactive or blocked by admin. Contract support for assistance.',
      );
    }

    // SEC-08: never link to a sign-up nobody verified; discard it instead
    if (user && !user.isEmailVerified) {
      return await this.usersService.claimPendingSignupForGoogle(
        user.id,
        createGoogleUserDto,
      );
    }

    if (user) {
      return user;
    }
    // Must be awaited: a floating rejection here crashes the whole process.
    return await this.usersService.createGoogleUser(createGoogleUserDto);
  }

  //ChangePassword
  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
    res: any,
  ) {
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

    await this.logoutAll(id); // Password changed: end every device's session
    res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions);

    return {
      message: 'Password changed successfully',
      generatedMaps: (await result).generatedMaps,
      raw: (await result).raw,
      affected: (await result).affected,
    };
  }

  //Forgot password
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    if (forgotPasswordDto.verificationMethod === VerificationMethod.SMS) {
      await this.settings.assertSmsEnabled(); // BE-25 admin switch
    }
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
        // Security: never return the reset token; it must only reach the user's inbox.
        return {
          message: `Password reset link sent to your email ${maskedEmail}`,
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
    if (resetPasswordDto.verificationMethod === VerificationMethod.SMS) {
      // BE-25: also stops codes that were sent before SMS was switched off
      await this.settings.assertSmsEnabled();
    }
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
      // SEC-05: only the latest code sent to *this* account, 5 guesses max
      const owner = resetPasswordDto.email
        ? await this.usersService.findByEmail(resetPasswordDto.email)
        : null;
      verification = await useSmsCode(
        this.verificationRepository,
        owner?.id,
        VerificationType.PASSWORD_RESET_OTP,
        resetPasswordDto.resetTokenOrOTP,
      );
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
      activity:
        resetPasswordDto.verificationMethod === VerificationMethod.EMAIL
          ? ActivityType.USER_RESET_PASSWORD_BY_EMAIL_TOKEN
          : ActivityType.USER_RESET_PASSWORD_BY_SMS_OTP,
      description:
        resetPasswordDto.verificationMethod === VerificationMethod.EMAIL
          ? 'User reset password via EMAIL Verification'
          : 'User reset password via SMS Verification',
      user: user,
    };

    await this.activityLogsService.createActivityLog(activityLog);

    await this.logoutAll(user.id); // Password reset: end every device's session

    return { message: 'Password reset successful' };
  }

  //Check if phone number is already verified
  async phoneVerification(userId: string) {
    await this.settings.assertSmsEnabled(); // BE-25 admin switch
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

    const fullName = user.firstName + ' ' + (user.lastName || '');

    const response = await this.smsService.sendOtpPhoneVerification(
      user.phone,
      fullName,
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
  /** SEC-05: only the caller's own latest code counts, 5 guesses max. */
  async verifyPhone(userId: string, verifyPhoneDto: VerifyPhoneDto) {
    await this.settings.assertSmsEnabled(); // BE-25 admin switch
    const verification = await useSmsCode(
      this.verificationRepository,
      userId,
      VerificationType.PHONE_VERIFICATION,
      verifyPhoneDto.otp,
    );

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
