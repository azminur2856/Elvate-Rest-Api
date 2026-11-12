import { ApiTags } from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Request,
  Res,
  UploadedFiles,
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
import { PhotoFieldsUpload } from 'src/common/upload';
import { Request as ExpressRequest, Response } from 'express';
import { encryptSessionCookie } from './utility/jose-cookie';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  clearSessionCookieOptions,
} from './utility/session-cookie.options';
import { FaceLoginService } from './face-login/face-login.service';
import { FaceChallengeDto, FaceLoginDto } from './face-login/face-login.dto';
import { clientIp } from './throttle/rate-limit';

const FRONTEND_URL = process.env.FRONTEND_URL;

/** The two face-login frames (multipart file fields). */
type FaceFrames = {
  neutral?: Express.Multer.File[];
  action?: Express.Multer.File[];
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
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

  /**
   * SEC-04 face login, step 2 (multipart): `email`, `challengeId` and two
   * photos, `neutral` (looking at the camera) and `action` (after doing the
   * prompt). Success sets the session cookie like a password login. Every
   * failure is the same 401; 5 per 15 minutes per e-mail or IP lock face
   * login for 15 minutes (429).
   */
  @Public()
  @Post('login-with-face')
  @UseInterceptors(PhotoFieldsUpload(['neutral', 'action']))
  @RateLimit(RATE_LIMITS.loginWithFace)
  async loginWithFace(
    @Request() req: ExpressRequest,
    @Body() dto: FaceLoginDto,
    @UploadedFiles() files: FaceFrames | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const neutral = files?.neutral?.[0];
    const action = files?.action?.[0];
    if (!neutral || !action) {
      throw new BadRequestException(
        'Send two photos: "neutral" (looking at the camera) and "action" (after the prompt).',
      );
    }
    const userAgent = req.headers['user-agent'];
    const user = await this.faceLogin.verify({
      email: dto.email,
      challengeId: dto.challengeId,
      neutral: neutral.buffer,
      action: action.buffer,
      ip: clientIp(req),
    });

    // --- Set session cookie like in normal login ---
    const cookieData = await this.authService.login(
      user.id,
      'faceLogin',
      userAgent,
    );
    const cookieDataEncrypted = await encryptSessionCookie(cookieData);
    res.cookie(SESSION_COOKIE, cookieDataEncrypted, sessionCookieOptions);
    this.faceLogin.notifySignIn(user, userAgent);

    return {
      verified: true,
      message: 'Face verified and logged in.',
    };
  }
}
