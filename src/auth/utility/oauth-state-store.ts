import { randomBytes, timingSafeEqual } from 'crypto';
import type { CookieOptions, Request } from 'express';
import type {
  Metadata,
  StateStore,
  StateStoreStoreCallback,
  StateStoreVerifyCallback,
} from 'passport-oauth2';

/** SEC-08: the OAuth `state` lives in this short-lived httpOnly cookie. */
export const OAUTH_STATE_COOKIE = 'elvate_oauth_state';

const STATE_TTL_MS = 10 * 60_000;

/**
 * `path: '/'` because the browser reaches this API through the frontend proxy
 * (`/api/backend/auth/google/...`), so the API's own path is not what the
 * browser sees. SameSite=Lax: the callback is a top-level GET from Google.
 */
export const oauthStateCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
});

const same = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * passport-oauth2 state store without server sessions: a random state goes
 * into Google's redirect URL and into a cookie; the callback must bring the
 * same value back. This stops "login CSRF" (an attacker finishing a Google
 * sign-in inside the victim's browser with the attacker's own code).
 *
 * passport picks the call shape by `fn.length`: store() has 3 parameters
 * (req, meta, cb) and verify() 4 (req, state, meta, cb).
 */
export class CookieStateStore implements StateStore {
  store(req: Request, callback: StateStoreStoreCallback): void;
  store(req: Request, meta: Metadata, callback: StateStoreStoreCallback): void;
  store(
    req: Request,
    metaOrCallback: Metadata | StateStoreStoreCallback,
    callback?: StateStoreStoreCallback,
  ): void {
    const done = (callback ?? metaOrCallback) as StateStoreStoreCallback;
    const state = randomBytes(24).toString('base64url');
    req.res?.cookie(OAUTH_STATE_COOKIE, state, {
      ...oauthStateCookieOptions(),
      maxAge: STATE_TTL_MS,
    });
    done(null, state);
  }

  verify(req: Request, state: string, callback: StateStoreVerifyCallback): void;
  verify(
    req: Request,
    state: string,
    meta: Metadata,
    callback: StateStoreVerifyCallback,
  ): void;
  verify(
    req: Request,
    state: string,
    metaOrCallback: Metadata | StateStoreVerifyCallback,
    callback?: StateStoreVerifyCallback,
  ): void {
    const done = (callback ?? metaOrCallback) as StateStoreVerifyCallback;
    const cookies = req.cookies as Record<string, string> | undefined;
    const expected = cookies?.[OAUTH_STATE_COOKIE];
    req.res?.clearCookie(OAUTH_STATE_COOKIE, oauthStateCookieOptions());
    if (!expected || typeof state !== 'string' || !same(expected, state)) {
      done(null as unknown as Error, false, {
        message: 'Invalid or expired sign-in request. Please try again.',
      });
      return;
    }
    done(null as unknown as Error, true, state);
  }
}
