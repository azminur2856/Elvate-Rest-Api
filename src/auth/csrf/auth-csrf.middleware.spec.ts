import {
  ForbiddenException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthCsrfMiddleware, frontendOrigin } from './auth-csrf.middleware';

// SEC-13: cross-site forms must not reach the auth routes.
describe('AuthCsrfMiddleware', () => {
  const mw = new AuthCsrfMiddleware();
  const saved = process.env.FRONTEND_URL;
  beforeAll(() => {
    process.env.FRONTEND_URL = 'https://shop.example.com/';
  });
  afterAll(() => {
    process.env.FRONTEND_URL = saved;
  });

  const run = (
    method: string,
    url: string,
    headers: Record<string, string> = {},
  ) => {
    const next = jest.fn();
    const req = { method, originalUrl: url, headers } as unknown as Request;
    let error: unknown;
    try {
      mw.use(req, {} as Response, next);
    } catch (e) {
      error = e;
    }
    return { passed: next.mock.calls.length === 1, error };
  };
  const body = (type: string) => ({
    'content-type': type,
    'content-length': '42',
  });

  it('lets JSON bodies through', () => {
    expect(
      run('POST', '/auth/login', body('application/json; charset=utf-8'))
        .passed,
    ).toBe(true);
  });

  it.each([
    'application/x-www-form-urlencoded',
    'multipart/form-data; boundary=x',
    'text/plain',
  ])('refuses a %s body on /auth/login with 415', (type) => {
    const r = run('POST', '/auth/login', body(type));
    expect(r.passed).toBe(false);
    expect(r.error).toBeInstanceOf(UnsupportedMediaTypeException);
  });

  it('ignores reads and requests without a body', () => {
    expect(run('GET', '/auth/google/login').passed).toBe(true);
    expect(run('POST', '/auth/logout').passed).toBe(true);
    expect(run('POST', '/auth/refresh', { 'content-length': '0' }).passed).toBe(
      true,
    );
  });

  it('face login: multipart only, and only from the frontend origin', () => {
    const face = '/auth/login-with-face';
    const mp = body('multipart/form-data; boundary=x');
    expect(
      run('POST', face, { ...mp, origin: 'https://shop.example.com' }).passed,
    ).toBe(true);
    expect(run('POST', face, mp).passed).toBe(true); // no Origin: not a browser form
    expect(
      run('POST', face, { ...mp, origin: 'https://evil.example' }).error,
    ).toBeInstanceOf(ForbiddenException);
    expect(
      run('POST', face, body('application/x-www-form-urlencoded')).error,
    ).toBeInstanceOf(UnsupportedMediaTypeException);
  });

  it('frontendOrigin() strips the path; bad or missing values give null', () => {
    expect(frontendOrigin()).toBe('https://shop.example.com');
    process.env.FRONTEND_URL = 'not a url';
    expect(frontendOrigin()).toBeNull();
    process.env.FRONTEND_URL = 'https://shop.example.com/';
  });
});
