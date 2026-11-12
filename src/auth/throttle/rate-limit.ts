import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

const MINUTE = 60_000;

/**
 * Limits per route (B-09). Counted per logged-in user, else per client IP
 * (see `throttlerTracker`). Sized so a class demo on one Wi-Fi still works.
 */
export const RATE_LIMITS = {
  login: { limit: 10, ttl: MINUTE },
  loginWithFace: { limit: 5, ttl: MINUTE }, // each attempt is a paid Face++ call
  faceSetup: { limit: 5, ttl: 15 * MINUTE }, // Face++ call + ImageKit upload
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

/**
 * Best-effort client address. In production a request arrives through the
 * Vercel rewrite and then Render's proxy, so `req.ip` (trust proxy = 1) is a
 * shared Vercel egress address and would throttle every user together. The
 * left-most X-Forwarded-For entry is the client as seen by the first proxy.
 * Someone calling Render directly can forge it; fine for rate limiting, never
 * use it for authorization.
 */
export function clientIp(req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}): string {
  const xff = req.headers?.['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
  return first || req.ip || 'unknown';
}

export function throttlerTracker(req: {
  user?: { id?: string };
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}): string {
  return req.user?.id ? `user:${req.user.id}` : `ip:${clientIp(req)}`;
}
