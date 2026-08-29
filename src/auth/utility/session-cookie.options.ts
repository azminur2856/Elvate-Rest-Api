import { CookieOptions } from 'express';

/**
 * Single source of truth for the encrypted `session` cookie.
 *
 * The frontend proxies every API call through its own origin (Next.js rewrite
 * `/api/backend/*` -> this server), so from the browser's point of view the
 * cookie is always first-party and same-site. `sameSite: 'lax'` is therefore
 * sufficient and, unlike `'none'`, is accepted by browsers even when `secure`
 * is false (local http development).
 *
 * `secure` must be true in production (Render terminates TLS); make sure
 * NODE_ENV=production is set in the Render dashboard.
 */
const isProd = process.env.NODE_ENV === 'production';

export const SESSION_COOKIE = 'session';

export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
};

/** Same attributes minus maxAge, so clearCookie targets the exact same cookie. */
export const clearSessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
};
