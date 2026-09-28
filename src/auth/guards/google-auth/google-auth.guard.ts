import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const isCallback = req.path.endsWith('/google/callback');
    if (!isCallback) {
      return (await super.canActivate(context)) as boolean;
    }

    // On the OAuth callback, send failures back to the login page instead of
    // answering the browser with raw 401/500 JSON.
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (err) {
      const res = context.switchToHttp().getResponse<Response>();
      const message = (err as Error)?.message ?? '';
      const reason = /inactive|blocked/i.test(message)
        ? 'google_inactive'
        : 'google';
      if (reason === 'google') {
        console.error('Google OAuth callback failed:', err);
      }
      const frontend = (process.env.FRONTEND_URL ?? '').replace(/\/+$/, '');
      res.redirect(`${frontend}/login?error=${reason}`);
      // Response is already sent; Nest's exception filter skips sent responses.
      return false;
    }
  }
}
