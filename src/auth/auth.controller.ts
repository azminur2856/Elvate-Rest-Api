import {
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
import { AuthGuard } from '@nestjs/passport';
import { LocalAuthGuard } from './guards/local-auth/local-auth.guard';
import { RefreshAuthGuard } from './guards/refresh-auth/refresh-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { GoogleAuthGuard } from './guards/google-auth/google-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyPhoneDto } from './dto/verify-Phone.dto';
import { resizeToBase64 } from './utility/resize-to-base64.util';
import { FaceVerificationService } from 'src/users/services/face-verification.service';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { encryptSessionCookie } from './utility/jose-cookie';

const FRONTEND_URL = process.env.FRONTEND_URL;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly faceVerificationService: FaceVerificationService,
  ) {}

  @Public()
  @Get('verifyRegistration')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyRegistratioin(token);
  }

  // @Public()
  // @HttpCode(HttpStatus.OK)
  // @UseGuards(LocalAuthGuard)
  // @Post('login')
  // async login(@Request() req) {
  //   return await this.authService.login(req.user.id);
  // }

  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Res({ passthrough: true }) res: Response) {
    const cookieData = await this.authService.login(req.user.id, 'localLogin');

    // Encrypt the session data before setting it in the cookie
    const cookieDataEncrypted = await encryptSessionCookie(cookieData);

    // Set a single HTTP-only cookie named 'session'
    res.cookie('session', cookieDataEncrypted, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    // Optionally, return only minimal info
    return { success: true };
  }

  // @Public()
  // @UseGuards(RefreshAuthGuard)
  // @Post('refresh')
  // refreshToken(@Req() req) {
  //   return this.authService.refreshToken(req.user.id);
  // }

  @Public()
  @UseGuards(RefreshAuthGuard) // uses "refresh-jwt" strategy above
  @Post('refresh')
  async refreshToken(@Req() req, @Res({ passthrough: true }) res: Response) {
    console.log('Cookies:', req.cookies);

    const cookieData = await this.authService.refreshToken(req.user.id);

    // Encrypt the session data before setting it in the cookie
    const cookieDataEncrypted = await encryptSessionCookie(cookieData);

    // Set a single HTTP-only cookie named 'session'
    res.cookie('session', cookieDataEncrypted, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    // Optionally, return only minimal info
    return { success: true };
  }

  @Post('logout')
  async signout(@Request() req, @Res({ passthrough: true }) res: Response) {
    // Clear the session cookie
    res.clearCookie('session');
    return this.authService.logout(req.user.id);
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/login')
  googleLogin() {}

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  // async googleCallback(@Req() req, @Res() res) {
  //   const respons = await this.authService.login(req.user.id);
  //   res.redirect(
  //     `http://localhost:3000/auth/view/google-login-success.html?access_token=${respons.accessToken}&refresh_token=${respons.refreshToken}`,
  //   );
  // }
  async googleCallback(@Request() req, @Res() res: Response) {
    const cookieData = await this.authService.login(req.user.id, 'googleOAuth');

    // Encrypt the session data before setting it in the cookie
    const cookieDataEncrypted = await encryptSessionCookie(cookieData);

    // Set a single HTTP-only cookie named 'session'
    res.cookie('session', cookieDataEncrypted, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    // Redirect to profile page
    return res.redirect(`${FRONTEND_URL}/auth/google`);

    // Optionally, return only minimal info
    //return { success: true };
  }

  @Patch('changePassword')
  async updatePassword(
    @Req() req: any,
    @Body(ValidationPipe) changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  @Public()
  @Post('forgotPassword')
  async forgotPassword(
    @Body(ValidationPipe) forgotPasswordDto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Put('resetPassword')
  async resetPassword(
    @Body(ValidationPipe) resetPasswordDto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('getOtpForPhoneVerification')
  async phoneVerification(@Request() req) {
    return await this.authService.phoneVerification(req.user.id);
  }

  @Post('verifyPhone')
  async verifyPhone(@Body(ValidationPipe) verifyPhoneDto: VerifyPhoneDto) {
    return this.authService.verifyPhone(verifyPhoneDto);
  }

  // @Public()
  // @Post('login-with-face')
  // @UseInterceptors(FileInterceptor('liveImage'))
  // async loginWithFace(
  //   @Body('email') email: string,
  //   @UploadedFile() file: Express.Multer.File,
  // ) {
  //   const user = await this.authService.getVerifiedFaceUserByEmail(email);

  //   const profileImagePath = path.join(
  //     __dirname,
  //     '..',
  //     '..',
  //     'assets',
  //     'user_profile_image',
  //     `user_${user.id}`,
  //     user.profileImage,
  //   );

  //   if (!fs.existsSync(profileImagePath)) {
  //     throw new NotFoundException('Profile image not found');
  //   }

  //   const profileImageBuffer = fs.readFileSync(profileImagePath);
  //   const profileImageBase64 = await resizeToBase64(profileImageBuffer);
  //   const liveImageBase64 = await resizeToBase64(file.buffer);

  //   const isMatch = await this.faceVerificationService.compareFacesForLogin(
  //     profileImageBase64,
  //     liveImageBase64,
  //   );

  //   if (!isMatch) {
  //     return {
  //       verified: false,
  //       message: '❌ Face does not match. Try again.',
  //     };
  //   }

  //   const tokens = await this.authService.login(user.id);

  //   return {
  //     verified: true,
  //     message: '✅ Face verified and logged in.',
  //     ...tokens,
  //   };
  // }

  @Public()
  @Post('login-with-face')
  @UseInterceptors(FileInterceptor('liveImage'))
  async loginWithFace(
    @Body('email') email: string,
    @UploadedFile() file: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.getVerifiedFaceUserByEmail(email);

    const profileImagePath = path.join(
      __dirname,
      '..',
      '..',
      'assets',
      'user_profile_image',
      `user_${user.id}`,
      user.profileImage,
    );

    if (!fs.existsSync(profileImagePath)) {
      throw new NotFoundException('Profile image not found');
    }

    const profileImageBuffer = fs.readFileSync(profileImagePath);
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
    const cookieData = await this.authService.login(user.id, 'faceLogin');
    const cookieDataEncrypted = await encryptSessionCookie(cookieData);

    res.cookie('session', cookieDataEncrypted, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    return {
      verified: true,
      message: '✅ Face verified and logged in.',
    };
  }
}
