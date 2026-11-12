import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** The only auth route that takes multipart (two camera frames). */
const MULTIPART_ROUTES = ['/auth/login-with-face'];

const hasBody = (req: Request) =>
  Number(req.headers['content-length'] ?? 0) > 0 ||
  req.headers['transfer-encoding'] !== undefined;

const mediaType = (req: Request) =>
  (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();

/** Origin of FRONTEND_URL, or null when it is not configured. */
export const frontendOrigin = (): string | null => {
  try {
    return process.env.FRONTEND_URL
      ? new URL(process.env.FRONTEND_URL).origin
      : null;
  } catch {
    return null;
  }
};

/**
 * SEC-13 login CSRF. An HTML form on another site can POST
 * `application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain`
 * without any CORS check, e.g. to sign the visitor into the attacker's
 * account. On the auth routes a request with a body must therefore be
 * `application/json` (a cross-site page cannot send that without CORS
 * allowing it). Face login is multipart, so there the browser's `Origin`
 * must be the frontend's.
 */
@Injectable()
export class AuthCsrfMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (!WRITE_METHODS.has(req.method) || !hasBody(req)) return next();
    const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
    const type = mediaType(req);

    if (MULTIPART_ROUTES.some((r) => path.endsWith(r))) {
      const origin = req.headers.origin;
      const allowed = frontendOrigin();
      if (origin && allowed && origin !== allowed) {
        throw new ForbiddenException('Cross-site request refused');
      }
      if (type !== 'multipart/form-data') {
        throw new UnsupportedMediaTypeException(
          'Send the photos as multipart/form-data',
        );
      }
      return next();
    }

    if (type !== 'application/json') {
      throw new UnsupportedMediaTypeException(
        'Send the request body as application/json',
      );
    }
    next();
  }
}
