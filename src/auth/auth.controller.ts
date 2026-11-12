import { ApiTags } from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth/local-auth.guard';
import { RefreshAuthGuard } from './guards/refresh-auth/refresh-auth.guard';
import { Public } from './decorators/public.decorator';
import { RATE_LIMITS, RateLimit } from './throttle/rate-limit';
import { GoogleAuthGuard } from './guards/google-auth/google-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyPhoneDto } from './dto/verify-Phone.dto';
import { resizeToBase64 } from './utility/resize-to-base64.util';
import { FaceVerificationService } from 'src/users/services/face-verification.service';
import {
  FACE_PHOTO_UPLOAD,
  NO_FACE_PHOTO,
  SingleFileUpload,
} from 'src/common/upload';
import { Response } from 'express';
import { encryptSessionCookie } from './utility/jose-cookie';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  clearSessionCookieOptions,
} from './utility/session-cookie.options';
import axios from 'axios';
import { FaceLoginService } from './face-login/face-login.service';
import { FaceChallengeDto } from './face-login/face-login.dto';

const FRONTEND_URL = process.env.FRONTEND_URL;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly faceVerificationService: FaceVerificationService,
    private readonly faceLogin: FaceLoginService,
  ) {}

  @Public()
  @Get('verifyRegistration')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyRegistratioin(token);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @RateLimit(RATE_LIMITS.login)
  async login(@Request() req, @Res({ passthrough: true }) res: Response) {
    const cookieData = await this.authService.login(
      req.user.id,
      'localLogin',
      req.headers['user-agent'],
    );

    // Encrypt the session data before setting it in the cookie
    const cookieDataEncrypted = await encryptSessionCookie(cookieData);

    // Set a single HTTP-only cookie named 'session'
    res.cookie(SESSION_COOKIE, cookieDataEncrypted, sessionCookieOptions);

    // Optionally, return only minimal info
    return { success: true };
  }

  @Public()
  @UseGuards(RefreshAuthGuard) // uses "refresh-jwt" strategy above
  @Post('refresh')
  async refreshToken(@Req() req, @Res({ passthrough: true }) res: Response) {
    const cookieData = await this.authService.refreshToken(
      req.user.id,
      req.user.sid,
    );

    // Encrypt the session data before setting it in the cookie
    const cookieDataEncrypted = await encryptSessionCookie(cookieData);

    // Set a single HTTP-only cookie named 'session'
    res.cookie(SESSION_COOKIE, cookieDataEncrypted, sessionCookieOptions);

    // Optionally, return only minimal info
    return { success: true };
  }

  @Post('logout')
  async signout(@Request() req, @Res({ passthrough: true }) res: Response) {
    // Clear the session cookie (options must match the ones it was set with)
    res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions);
    return this.authService.logout(req.user.id, req.user.sid);
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/login')
  googleLogin() {}

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(@Request() req, @Res() res: Response) {
    const cookieData = await this.authService.login(
      req.user.id,
      'googleOAuth',
      req.headers['user-agent'],
    );

    // Encrypt the session data before setting it in the cookie
    const cookieDataEncrypted = await encryptSessionCookie(cookieData);

    // Set a single HTTP-only cookie named 'session'
    res.cookie(SESSION_COOKIE, cookieDataEncrypted, sessionCookieOptions);

    // Redirect to profile page
    return res.redirect(`${FRONTEND_URL}/google`);
  }

  @Patch('changePassword')
  async updatePassword(
    @Req() req: any,
    @Body(ValidationPipe) changePasswordDto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.changePassword(req.user.id, changePasswordDto, res);
  }

  @Public()
  @Post('forgotPassword')
  @RateLimit(RATE_LIMITS.forgotPassword)
  async forgotPassword(
    @Body(ValidationPipe) forgotPasswordDto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Put('resetPassword')
  @RateLimit(RATE_LIMITS.resetPassword)
  async resetPassword(
    @Body(ValidationPipe) resetPasswordDto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('getOtpForPhoneVerification')
  @RateLimit(RATE_LIMITS.phoneOtp)
  async phoneVerification(@Request() req) {
    return await this.authService.phoneVerification(req.user.id);
  }

  @Post('verifyPhone')
  @RateLimit(RATE_LIMITS.verifyPhone)
  async verifyPhone(@Body(ValidationPipe) verifyPhoneDto: VerifyPhoneDto) {
    return this.authService.verifyPhone(verifyPhoneDto);
  }

  /**
   * SEC-04 face login, step 1: a random liveness prompt (TURN_HEAD or BLINK)
   * valid for 2 minutes and one attempt. Same answer for every e-mail.
   */
  @Public()
  @Post('face-login/challenge')
  @RateLimit(RATE_LIMITS.faceChallenge)
  faceLoginChallenge(@Body() dto: FaceChallengeDto) {
    return this.faceLogin.createChallenge(dto.email);
  }

  // face login endpoint using imagekit image URL and live image
  @Public()
  @Post('login-with-face')
  @UseInterceptors(SingleFileUpload('liveImage', FACE_PHOTO_UPLOAD))
  @RateLimit(RATE_LIMITS.loginWithFace)
  async loginWithFace(
    @Request() req,
    @Body('email') email: string,
    @UploadedFile() file: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!file) throw new BadRequestException(NO_FACE_PHOTO);
    const user = await this.authService.getVerifiedFaceUserByEmail(email);

    if (user.isActive === false) {
      throw new NotFoundException(
        'User is inactive or blocked by admin. Contact support for assistance.',
      );
    }

    const imageKitUrl = `${process.env.IMAGEKIT_URL_ENDPOINT}/user_profile_image/user_${user.id}/${user.profileImage}`;

    let profileImageBuffer: Buffer;
    try {
      const response = await axios.get(imageKitUrl, {
        responseType: 'arraybuffer',
      });
      profileImageBuffer = Buffer.from(response.data as ArrayBuffer);
    } catch {
      throw new NotFoundException(
        'Failed to download profile image from ImageKit',
      );
    }

    const profileImageBase64 = await resizeToBase64(profileImageBuffer);
    const liveImageBase64 = await resizeToBase64(file.buffer);

    const isMatch = await this.faceVerificationService.compareFacesForLogin(
      profileImageBase64,
      liveImageBase64,
    );

    if (!isMatch) {
      return {
        verified: false,
        message: '❌ Face does not match. Try again.',
      };
    }

    // --- Set session cookie like in normal login ---
    const cookieData = await this.authService.login(
      user.id,
      'faceLogin',
      req.headers['user-agent'],
    );
    const cookieDataEncrypted = await encryptSessionCookie(cookieData);

    res.cookie(SESSION_COOKIE, cookieDataEncrypted, sessionCookieOptions);

    return {
      verified: true,
      message: '✅ Face verified and logged in.',
    };
  }
}
