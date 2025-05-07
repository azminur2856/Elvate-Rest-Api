import {
  Controller,
  Post,
  Body,
  ForbiddenException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/CreateUser.dto';
import { RequestOtpDto } from 'src/user/dto/request_otp.dto';
import { VerifyOtpDto } from 'src/user/dto/verify_otp.dto';
import { AuthGuard } from '@nestjs/passport';
import { NoJwtBlacklistGuard } from './custom_decoretors/no_jwt_blacklist.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('request-otp')
  @NoJwtBlacklistGuard()
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Post('verify-otp')
  @NoJwtBlacklistGuard()
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('login')
  @NoJwtBlacklistGuard()
  async login(@Body() loginDto: { email: string; password: string }) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      throw new ForbiddenException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Req() req) {
    const userId = req.user.userId;

    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(' ')[1];

    if (!accessToken) {
      throw new Error('Access token not found in Authorization header');
    }

    await this.authService.logout(userId, accessToken);
    return { message: 'Logged out successfully' };
  }
}
