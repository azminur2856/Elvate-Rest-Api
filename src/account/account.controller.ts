import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AccountService } from './account.service';
import { DeleteAccountDto } from './dto/account.dto';
import {
  clearSessionCookieOptions,
  SESSION_COOKIE,
} from 'src/auth/utility/session-cookie.options';
import { RateLimit } from 'src/auth/throttle/rate-limit';
import type { AuthRequest } from 'src/common/auth-user';

/** Account settings (BE-20): devices + delete account. */
@ApiTags('Account')
@Controller()
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('auth/sessions')
  sessions(@Req() req: AuthRequest) {
    return this.account.listSessions(req.user);
  }

  /** Revoking the current session also clears the cookie (= logout). */
  @Delete('auth/sessions/:id')
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { wasCurrent } = await this.account.revokeSession(req.user, id);
    if (wasCurrent) res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions);
    return { success: true };
  }

  @Post('auth/logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.account.logoutAll(req.user);
    res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions);
    return { success: true };
  }

  @Delete('users/me')
  @RateLimit({ limit: 5, ttl: 15 * 60_000 })
  async deleteMe(
    @Body() dto: DeleteAccountDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.account.deleteMe(req.user, dto);
    res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions);
    return { success: true };
  }
}
