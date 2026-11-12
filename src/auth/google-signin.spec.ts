import type { Request } from 'express';
import {
  CookieStateStore,
  OAUTH_STATE_COOKIE,
} from './utility/oauth-state-store';
import { isGoogleVerified } from './strategies/google.strategy';
import { AuthService } from './auth.service';

// SEC-08: Google sign-in hardening.
describe('CookieStateStore (OAuth state)', () => {
  const store = new CookieStateStore();
  const fakeReq = (cookies: Record<string, string> = {}) => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() };
    return { req: { cookies, res } as unknown as Request, res };
  };

  it('keeps the parameter counts passport dispatches on', () => {
    expect(store.store.length).toBe(3);
    expect(store.verify.length).toBe(4);
  });

  it('store(): a random state in the URL and in an httpOnly cookie', () => {
    const { req, res } = fakeReq();
    const states: string[] = [];
    store.store(req, {} as never, (_e, s: string) => states.push(s));
    store.store(req, {} as never, (_e, s: string) => states.push(s));
    expect(states[0]).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(states[0]).not.toBe(states[1]);
    expect(res.cookie).toHaveBeenCalledWith(
      OAUTH_STATE_COOKIE,
      states[0],
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  it('verify(): only the same state passes; the cookie is always cleared', () => {
    const run = (cookie: string | undefined, state: string) => {
      const { req, res } = fakeReq(
        cookie ? { [OAUTH_STATE_COOKIE]: cookie } : {},
      );
      let ok: boolean | undefined;
      store.verify(req, state, {} as never, (_e, passed) => (ok = passed));
      expect(res.clearCookie).toHaveBeenCalled();
      return ok;
    };
    expect(run('abc', 'abc')).toBe(true);
    expect(run('abc', 'abd')).toBe(false);
    expect(run(undefined, 'abc')).toBe(false); // login CSRF: no cookie
  });
});

describe('isGoogleVerified', () => {
  it('accepts only an explicit true', () => {
    expect(isGoogleVerified(true)).toBe(true);
    expect(isGoogleVerified('true')).toBe(true);
    expect(isGoogleVerified(false)).toBe(false);
    expect(isGoogleVerified(undefined)).toBe(false);
    expect(isGoogleVerified('false')).toBe(false);
  });
});

describe('AuthService.validateGoogleUser', () => {
  const users = {
    findByEmail: jest.fn(),
    createGoogleUser: jest.fn(),
    claimPendingSignupForGoogle: jest.fn(),
  };
  const service = new AuthService(
    {} as never,
    users as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const google = {
    firstName: 'Real',
    lastName: 'Owner',
    email: 'owner@example.com',
    password: '',
    isActive: true,
    isEmailVerified: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it('an unverified sign-up with that address is discarded, not linked', async () => {
    users.findByEmail.mockResolvedValueOnce({
      id: 'u1',
      isActive: true,
      isEmailVerified: false,
    });
    users.claimPendingSignupForGoogle.mockResolvedValueOnce({ id: 'u1' });
    await expect(service.validateGoogleUser(google)).resolves.toEqual({
      id: 'u1',
    });
    expect(users.claimPendingSignupForGoogle).toHaveBeenCalledWith(
      'u1',
      google,
    );
  });

  it('a verified account is linked as before; a new address is created', async () => {
    const verified = { id: 'u2', isActive: true, isEmailVerified: true };
    users.findByEmail.mockResolvedValueOnce(verified);
    await expect(service.validateGoogleUser(google)).resolves.toBe(verified);
    users.findByEmail.mockResolvedValueOnce(null);
    users.createGoogleUser.mockResolvedValueOnce({ id: 'u3' });
    await expect(service.validateGoogleUser(google)).resolves.toEqual({
      id: 'u3',
    });
    expect(users.claimPendingSignupForGoogle).not.toHaveBeenCalled();
  });
});
