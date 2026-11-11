import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import { IS_PUBLIC_KEY } from './public.decorator';

export const OPTIONAL_AUTH_KEY = 'optionalAuth';

/**
 * Public route that still recognises a logged-in caller: `req.user` is set
 * when the session cookie is valid and undefined otherwise (never a 401).
 * E.g. GET /products/:slug shows inactive products to ADMIN/STAFF only.
 */
export const OptionalAuth = () =>
  applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    SetMetadata(OPTIONAL_AUTH_KEY, true),
    ApiExtension('x-optional-auth', true),
  );
