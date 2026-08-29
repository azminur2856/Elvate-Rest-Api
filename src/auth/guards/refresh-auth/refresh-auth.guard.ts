import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import {
  SESSION_COOKIE,
  clearSessionCookieOptions,
} from '../../utility/session-cookie.options';

@Injectable()
export class RefreshAuthGuard extends AuthGuard('refresh-jwt') {
  /**
   * When the refresh token is missing, expired, or no longer matches the one
   * stored for the user (e.g. the user logged in from another device), clear
   * the stale `session` cookie before rejecting. Otherwise the browser keeps a
   * cookie that the Next.js middleware still treats as "logged in", and the
   * app ping-pongs between /login and / forever.
   */
  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any,
  ): TUser {
    if (err || !user) {
      const res = context.switchToHttp().getResponse<Response>();
      res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions);
    }
    return super.handleRequest(err, user, info, context, status);
  }
}
