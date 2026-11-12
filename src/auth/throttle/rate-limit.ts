import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { isIP } from 'net';

const MINUTE = 60_000;

/**
 * Limits per route (B-09). Counted per logged-in user, else per client IP
 * (see `throttlerTracker`). Sized so a class demo on one Wi-Fi still works.
 */
export const RATE_LIMITS = {
  login: { limit: 10, ttl: MINUTE },
  loginWithFace: { limit: 5, ttl: MINUTE }, // each attempt is a paid Face++ call
  faceSetup: { limit: 5, ttl: 15 * MINUTE }, // Face++ call + ImageKit upload
  faceChallenge: { limit: 10, ttl: 15 * MINUTE },
  // SEC-11: per user (orders need a login); stops scripted hoarding
  placeOrder: { limit: 5, ttl: 10 * MINUTE },
  orderQuote: { limit: 30, ttl: MINUTE },
  createUser: { limit: 10, ttl: 10 * MINUTE },
  forgotPassword: { limit: 5, ttl: 15 * MINUTE }, // sends an e-mail / SMS
  resetPassword: { limit: 10, ttl: 15 * MINUTE }, // OTP / token guessing
  phoneOtp: { limit: 3, ttl: 10 * MINUTE }, // sends an SMS
  verifyPhone: { limit: 10, ttl: 10 * MINUTE }, // 6-digit OTP guessing
} as const;

/**
 * Rate-limit one route. Place it as the **last** decorator above the handler
 * (below any other `@UseGuards`) so the throttler runs first and also counts
 * attempts that a later guard rejects, e.g. a wrong password in
 * LocalAuthGuard.
 */
export const RateLimit = (rule: { limit: number; ttl: number }) =>
  applyDecorators(
    UseGuards(ThrottlerGuard),
    Throttle({ default: { limit: rule.limit, ttl: rule.ttl } }),
  );

/** SEC-06: headers the frontend proxy adds (server side, never the browser). */
export const PROXY_SECRET_HEADER = 'x-elvate-proxy-secret';
export const PROXY_CLIENT_IP_HEADER = 'x-elvate-client-ip';

type IpRequest = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
};

const header = (req: IpRequest, name: string): string | undefined => {
  const v = req.headers?.[name];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
};

const sameSecret = (given: string | undefined, secret: string): boolean => {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Client address for rate limits and sign-in locks (never for authorization).
 *
 * With `PROXY_SHARED_SECRET` set (SEC-06): the browser's address is taken from
 * `x-elvate-client-ip` **only** when `x-elvate-proxy-secret` matches, i.e. the
 * request came through our own frontend proxy. Anyone else is keyed on the
 * address that connected to Render (`req.ip`, trust proxy = 1), which they
 * cannot forge.
 *
 * Without the secret (until both sides are configured) it keeps the old
 * behaviour: the left-most X-Forwarded-For entry, which a direct caller can
 * forge. Keying on `req.ip` there would put every Vercel user in one bucket.
 */
export function clientIp(req: IpRequest): string {
  const secret = process.env.PROXY_SHARED_SECRET?.trim();
  if (secret) {
    if (sameSecret(header(req, PROXY_SECRET_HEADER), secret)) {
      const forwarded = header(req, PROXY_CLIENT_IP_HEADER);
      if (forwarded && isIP(forwarded)) return forwarded;
    }
    return req.ip || 'unknown';
  }
  const xff = header(req, 'x-forwarded-for');
  return xff?.split(',')[0]?.trim() || req.ip || 'unknown';
}

export function throttlerTracker(req: {
  user?: { id?: string };
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}): string {
  return req.user?.id ? `user:${req.user.id}` : `ip:${clientIp(req)}`;
}
