import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { decryptSessionCookie } from '../utility/jose-cookie';

@Injectable()
export class DecryptSessionMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const sessionCookie = req.cookies?.session;
    if (sessionCookie) {
      try {
        const session = await decryptSessionCookie(sessionCookie);
        req['accessToken'] = session.accessToken;
        req['refreshToken'] = session.refreshToken;
        req['session'] = session; // optionally attach the whole session
      } catch {
        req['accessToken'] = undefined;
        req['refreshToken'] = undefined;
        req['session'] = undefined;
      }
    }
    next();
  }
}
